package com.vexaris.webview

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.net.http.SslError
import android.util.Base64
import android.view.View
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import app.tauri.plugin.JSObject
import org.json.JSONObject
import java.io.ByteArrayOutputStream

@SuppressLint("SetJavaScriptEnabled")
internal class DappTab(
  val id: String,
  context: Context,
  private val host: VexWebviewPlugin,
) {
  val view: WebView = WebView(context)

  var url: String = ""
  var title: String = ""
  var favicon: String? = null
  var progress: Int = 0
  var loading: Boolean = false
  var error: String? = null
  var crashed: Boolean = false
  var desktop: Boolean = false

  var chainId: String? = null
  var accounts: List<String> = emptyList()
  var connected: Boolean = false

  private var scriptHandler: ScriptHandler? = null
  private var trackedOrigin: String = ""
  private var lastSentProgress = -1

  private val messageListener = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
  private val documentStart = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)

  init {
    val settings = view.settings
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = true
    settings.databaseEnabled = true
    settings.loadWithOverviewMode = false
    settings.useWideViewPort = false
    settings.setSupportZoom(false)
    settings.builtInZoomControls = false
    settings.displayZoomControls = false
    settings.setSupportMultipleWindows(false)
    settings.javaScriptCanOpenWindowsAutomatically = false
    settings.mediaPlaybackRequiresUserGesture = true
    settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
    settings.allowFileAccess = false
    settings.allowContentAccess = false
    settings.setGeolocationEnabled(false)
    settings.safeBrowsingEnabled = true
    settings.cacheMode = WebSettings.LOAD_DEFAULT
    settings.userAgentString = defaultAgent(settings.userAgentString)

    view.setBackgroundColor(BACKGROUND)
    view.overScrollMode = View.OVER_SCROLL_NEVER
    view.isFocusable = true
    view.isFocusableInTouchMode = true
    view.webViewClient = Client()
    view.webChromeClient = Chrome()

    CookieManager.getInstance().setAcceptCookie(true)
    CookieManager.getInstance().setAcceptThirdPartyCookies(view, true)

    if (messageListener) {
      WebViewCompat.addWebMessageListener(view, "vexBridge", setOf("*")) { _, message, origin, isMainFrame, _ ->
        val body = try { message.data } catch (e: IllegalStateException) { null }
        if (body != null && isMainFrame) host.onProviderMessage(this, body, originUrl(origin))
      }
    } else {
      view.addJavascriptInterface(Bridge(), "VexBridge")
    }

    installProviderScript()
  }

  fun stateJson(): JSObject = JSObject().apply {
    put("id", id)
    put("url", url)
    put("title", title)
    put("favicon", favicon)
    put("progress", progress)
    put("loading", loading)
    put("canGoBack", view.canGoBack())
    put("canGoForward", view.canGoForward())
    put("desktop", desktop)
    put("crashed", crashed)
    put("error", error)
  }

  fun emit(force: Boolean = true) {
    if (!force && loading && progress != 100 && kotlin.math.abs(progress - lastSentProgress) < 20) return
    lastSentProgress = progress
    host.dispatch("tabState", stateJson())
  }

  fun providerStateJson(): JSObject = JSObject().apply {
    put("chainId", chainId)
    put("accounts", accounts)
    put("connected", connected && accounts.isNotEmpty())
  }

  fun installProviderScript() {
    if (!documentStart) return
    scriptHandler?.remove()
    scriptHandler = WebViewCompat.addDocumentStartJavaScript(
      view,
      ProviderScript.source(providerStateJson().toString()),
      setOf("*"),
    )
  }

  fun injectProviderNow() {
    evaluate(ProviderScript.source(providerStateJson().toString()))
  }

  fun sendEvent(name: String, data: Any?) {
    val payload = JSObject().apply {
      put("type", "event")
      put("name", name)
      put("data", data)
    }
    deliver(payload)
  }

  fun reply(payload: JSObject) = deliver(payload)

  private fun deliver(payload: JSObject) {
    val json = JSONObject.quote(payload.toString())
    evaluate(
      "if (window.__vexReply) { window.__vexReply($json); } " +
        "else { (window.__vexPending = window.__vexPending || []).push($json); }"
    )
  }

  fun evaluate(script: String) {
    if (crashed) return
    view.evaluateJavascript(script, null)
  }

  fun setDesktopMode(enabled: Boolean) {
    if (desktop == enabled) return
    desktop = enabled
    val base = defaultAgent(WebSettings.getDefaultUserAgent(view.context))
    view.settings.userAgentString = if (enabled) DESKTOP_AGENT else base
    view.settings.useWideViewPort = true
    view.settings.loadWithOverviewMode = true
    if (url.isNotEmpty() && !crashed) view.reload()
    emit()
  }

  fun load(target: String) {
    if (crashed) return
    error = null
    loading = true
    progress = 0
    url = target
    view.loadUrl(target)
    emit()
  }

  fun destroy() {
    scriptHandler?.remove()
    scriptHandler = null
    view.stopLoading()
    view.webChromeClient = WebChromeClient()
    view.webViewClient = WebViewClient()
    (view.parent as? android.view.ViewGroup)?.removeView(view)
    view.removeAllViews()
    view.destroy()
  }

  fun snapshot(maxWidth: Int): String? {
    if (crashed || view.width == 0 || view.height == 0) return null
    val scale = maxWidth.toFloat() / view.width.toFloat()
    val width = maxWidth.coerceAtLeast(1)
    val height = (view.height * scale).toInt().coerceAtLeast(1)
    return try {
      val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
      val canvas = android.graphics.Canvas(bitmap)
      canvas.scale(scale, scale)
      view.draw(canvas)
      val stream = ByteArrayOutputStream()
      bitmap.compress(Bitmap.CompressFormat.JPEG, 62, stream)
      bitmap.recycle()
      "data:image/jpeg;base64," + Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
    } catch (e: Throwable) {
      null
    }
  }

  private fun originUrl(origin: Uri): String =
    if (origin.host == null) trackedOrigin else origin.buildUpon().path("/").build().toString()

  private fun handleUri(raw: String): Boolean {
    val uri = try { Uri.parse(raw) } catch (e: Exception) { return true }
    return when (uri.scheme?.lowercase()) {
      "http", "https", "about", "data", "blob", "javascript" -> false
      "wc" -> {
        host.dispatch("pairUri", JSObject().apply { put("id", id); put("uri", raw) })
        true
      }
      null -> true
      else -> {
        openExternal(raw, uri)
        true
      }
    }
  }

  private fun openExternal(raw: String, uri: Uri) {
    val intent = if (uri.scheme.equals("intent", ignoreCase = true)) {
      try {
        Intent.parseUri(raw, Intent.URI_INTENT_SCHEME).apply {
          addCategory(Intent.CATEGORY_BROWSABLE)
          component = null
          selector = null
        }
      } catch (e: Exception) {
        null
      }
    } else {
      Intent(Intent.ACTION_VIEW, uri).apply { addCategory(Intent.CATEGORY_BROWSABLE) }
    }

    var opened = false
    if (intent != null) {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      opened = try {
        host.activity.startActivity(intent)
        true
      } catch (e: ActivityNotFoundException) {
        false
      } catch (e: SecurityException) {
        false
      }
    }
    host.dispatch("external", JSObject().apply {
      put("id", id)
      put("url", raw)
      put("opened", opened)
    })
  }

  private inner class Bridge {
    @android.webkit.JavascriptInterface
    fun postMessage(message: String?) {
      if (message == null) return
      host.onProviderMessage(this@DappTab, message, trackedOrigin)
    }
  }

  private inner class Client : WebViewClient() {
    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
      if (!request.isForMainFrame) return false
      return handleUri(request.url.toString())
    }

    @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
    override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean = handleUri(url)

    override fun onPageStarted(view: WebView, pageUrl: String?, icon: Bitmap?) {
      url = pageUrl ?: url
      trackedOrigin = originOf(url)
      loading = true
      error = null
      progress = 0
      title = ""
      favicon = null
      if (!documentStart) injectProviderNow()
      emit()
    }

    override fun onPageFinished(view: WebView, pageUrl: String?) {
      url = pageUrl ?: url
      loading = false
      progress = 100
      if (title.isEmpty()) title = view.title ?: ""
      if (!documentStart) injectProviderNow()
      emit()
    }

    override fun doUpdateVisitedHistory(view: WebView, pageUrl: String?, isReload: Boolean) {
      url = pageUrl ?: url
      trackedOrigin = originOf(url)
      emit()
    }

    override fun onReceivedError(view: WebView, request: WebResourceRequest, failure: WebResourceError) {
      if (!request.isForMainFrame) return
      loading = false
      error = failure.description?.toString() ?: "Sayfa yüklenemedi"
      emit()
    }

    override fun onReceivedHttpError(
      view: WebView,
      request: WebResourceRequest,
      response: WebResourceResponse,
    ) {
      if (!request.isForMainFrame || response.statusCode < 400) return
      error = "Sunucu " + response.statusCode + " yanıtı verdi"
      emit()
    }

    override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
      handler.cancel()
      loading = false
      this@DappTab.error = "Güvenli bağlantı kurulamadı (sertifika hatası)"
      emit()
    }

    override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean {
      crashed = true
      loading = false
      error = "Sayfa bellek nedeniyle kapandı"
      emit()
      return true
    }
  }

  private inner class Chrome : WebChromeClient() {
    override fun onProgressChanged(view: WebView, newProgress: Int) {
      progress = newProgress
      if (newProgress >= 100) loading = false
      emit(force = newProgress >= 100)
    }

    override fun onReceivedTitle(view: WebView, value: String?) {
      title = value ?: ""
      emit()
    }

    override fun onReceivedIcon(view: WebView, icon: Bitmap?) {
      if (icon == null) return
      favicon = encodeIcon(icon)
      emit()
    }

    override fun onShowFileChooser(
      view: WebView,
      callback: ValueCallback<Array<Uri>>,
      params: FileChooserParams,
    ): Boolean = host.pickFile(callback, params)

    override fun onPermissionRequest(request: PermissionRequest) {
      request.deny()
    }

    override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: android.webkit.GeolocationPermissions.Callback) {
      callback.invoke(origin, false, false)
    }
  }

  companion object {
    private const val BACKGROUND = 0xFF0B0A10.toInt()
    private const val DESKTOP_AGENT =
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

    fun originOf(value: String): String = try {
      val uri = Uri.parse(value)
      if (uri.host == null) "" else uri.scheme + "://" + uri.authority
    } catch (e: Exception) {
      ""
    }

    private fun defaultAgent(base: String): String =
      base.replace("; wv)", ")")

    private fun encodeIcon(icon: Bitmap): String? = try {
      val scaled = Bitmap.createScaledBitmap(icon, 64, 64, true)
      val stream = ByteArrayOutputStream()
      scaled.compress(Bitmap.CompressFormat.PNG, 100, stream)
      if (scaled !== icon) scaled.recycle()
      "data:image/png;base64," + Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
    } catch (e: Throwable) {
      null
    }
  }
}
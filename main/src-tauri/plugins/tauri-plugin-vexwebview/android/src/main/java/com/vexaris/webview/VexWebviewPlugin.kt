package com.vexaris.webview

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.view.View
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewDatabase
import android.widget.FrameLayout
import androidx.activity.result.ActivityResult
import androidx.appcompat.app.AppCompatActivity
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONArray
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException

@InvokeArg
internal class CreateArgs {
  lateinit var id: String
  var url: String? = null
  var chainId: String? = null
  var accounts: List<String>? = null
  var connected: Boolean = false
  var desktop: Boolean = false
}

@InvokeArg
internal class TabArgs {
  lateinit var id: String
}

@InvokeArg
internal class BoundsArgs {
  var x: Double = 0.0
  var y: Double = 0.0
  var width: Double = 0.0
  var height: Double = 0.0
}

@InvokeArg
internal class VisibleArgs {
  var visible: Boolean = true
}

@InvokeArg
internal class LoadArgs {
  lateinit var id: String
  lateinit var url: String
}

@InvokeArg
internal class DesktopArgs {
  lateinit var id: String
  var enabled: Boolean = false
}

@InvokeArg
internal class RespondArgs {
  lateinit var id: String
  var requestId: Long = 0
  var method: String? = null
  var result: Any? = null
  var error: Map<String, Any?>? = null
}

@InvokeArg
internal class ProviderArgs {
  lateinit var id: String
  var chainId: String? = null
  var accounts: List<String>? = null
  var connected: Boolean = false
}

@InvokeArg
internal class SnapshotArgs {
  lateinit var id: String
  var width: Int = 320
}

@TauriPlugin
class VexWebviewPlugin(internal val activity: Activity) : Plugin(activity) {

  private val tabs = LinkedHashMap<String, DappTab>()
  private val dispatcher = Executors.newSingleThreadExecutor()

  private var container: FrameLayout? = null
  private var mainView: WebView? = null
  private var activeId: String? = null
  private var overlayVisible = true
  private var bounds = BoundsArgs()
  private var fileCallback: ValueCallback<Array<Uri>>? = null
  private var destroyed = false

  override fun load(webView: WebView) {
    if (mainView != null) return
    mainView = webView
    container = webView.parent as? FrameLayout ?: activity.findViewById<FrameLayout>(android.R.id.content)
  }

  override fun onDestroy(activity: AppCompatActivity) {
    destroyed = true
    activity.runOnUiThread {
      tabs.values.toList().forEach { it.destroy() }
      tabs.clear()
      fileCallback?.onReceiveValue(null)
      fileCallback = null
    }
    dispatcher.shutdown()
  }

  override fun onPause(activity: AppCompatActivity) {
    activity.runOnUiThread { tabs.values.forEach { it.view.onPause() } }
  }

  override fun onResume(activity: AppCompatActivity) {
    activity.runOnUiThread { tabs[activeId]?.view?.onResume() }
  }


  @Command
  fun create(invoke: Invoke) {
    val args = invoke.parseArgs(CreateArgs::class.java)
    ui(invoke) {
      val parent = container ?: throw IllegalStateException("Tarayıcı katmanı henüz hazır değil")
      if (tabs.containsKey(args.id)) return@ui JSObject().put("id", args.id)
      if (tabs.size >= MAX_TABS) throw IllegalStateException("En fazla $MAX_TABS sekme açılabilir")

      val tab = DappTab(args.id, activity, this)
      tab.chainId = args.chainId
      tab.accounts = args.accounts ?: emptyList()
      tab.connected = args.connected
      tab.installProviderScript()
      if (args.desktop) tab.setDesktopMode(true)

      tabs[args.id] = tab
      parent.addView(tab.view, FrameLayout.LayoutParams(0, 0))
      tab.view.visibility = View.INVISIBLE
      tab.view.onPause()
      applyGeometry()

      args.url?.takeIf { it.isNotEmpty() }?.let { tab.load(it) }
      tab.emit()
      JSObject().put("id", args.id)
    }
  }

  @Command
  fun setBounds(invoke: Invoke) {
    val args = invoke.parseArgs(BoundsArgs::class.java)
    ui(invoke) {
      bounds = args
      applyGeometry()
      null
    }
  }

  @Command
  fun show(invoke: Invoke) {
    val args = invoke.parseArgs(TabArgs::class.java)
    ui(invoke) {
      val tab = tabs[args.id] ?: throw IllegalStateException("Sekme bulunamadı")
      val outgoing = activeId?.takeIf { it != args.id }?.let { tabs[it] }
      val image = outgoing?.snapshot(SNAPSHOT_WIDTH)
      activeId = args.id
      applyGeometry()
      tab.view.onResume()
      tab.emit()
      JSObject().apply {
        put("id", args.id)
        put("previousId", outgoing?.id)
        put("previousImage", image)
      }
    }
  }

  @Command
  fun hide(invoke: Invoke) {
    val args = invoke.parseArgs(TabArgs::class.java)
    ui(invoke) {
      if (activeId == args.id) activeId = null
      applyGeometry()
      null
    }
  }

  @Command
  fun setVisible(invoke: Invoke) {
    val args = invoke.parseArgs(VisibleArgs::class.java)
    ui(invoke) {
      overlayVisible = args.visible
      applyGeometry()
      null
    }
  }

  @Command
  fun loadUrl(invoke: Invoke) {
    val args = invoke.parseArgs(LoadArgs::class.java)
    ui(invoke) {
      tabById(args.id).load(args.url)
      null
    }
  }

  @Command
  fun goBack(invoke: Invoke) {
    val args = invoke.parseArgs(TabArgs::class.java)
    ui(invoke) {
      val tab = tabById(args.id)
      if (tab.view.canGoBack()) tab.view.goBack()
      tab.emit()
      null
    }
  }

  @Command
  fun goForward(invoke: Invoke) {
    val args = invoke.parseArgs(TabArgs::class.java)
    ui(invoke) {
      val tab = tabById(args.id)
      if (tab.view.canGoForward()) tab.view.goForward()
      tab.emit()
      null
    }
  }

  @Command
  fun reload(invoke: Invoke) {
    val args = invoke.parseArgs(TabArgs::class.java)
    ui(invoke) {
      val tab = tabById(args.id)
      tab.error = null
      if (tab.crashed) tab.load(tab.url.ifEmpty { "about:blank" }) else tab.view.reload()
      null
    }
  }

  @Command
  fun stopLoading(invoke: Invoke) {
    val args = invoke.parseArgs(TabArgs::class.java)
    ui(invoke) {
      val tab = tabById(args.id)
      tab.view.stopLoading()
      tab.loading = false
      tab.emit()
      null
    }
  }

  @Command
  fun setDesktopMode(invoke: Invoke) {
    val args = invoke.parseArgs(DesktopArgs::class.java)
    ui(invoke) {
      tabById(args.id).setDesktopMode(args.enabled)
      null
    }
  }

  @Command
  fun close(invoke: Invoke) {
    val args = invoke.parseArgs(TabArgs::class.java)
    ui(invoke) {
      removeTab(args.id)
      null
    }
  }

  @Command
  fun closeAll(invoke: Invoke) {
    ui(invoke) {
      tabs.keys.toList().forEach { removeTab(it) }
      null
    }
  }

  @Command
  fun respond(invoke: Invoke) {
    val args = invoke.parseArgs(RespondArgs::class.java)
    ui(invoke) {
      val tab = tabs[args.id] ?: return@ui null
      val payload = JSObject().apply {
        put("id", args.requestId)
        args.method?.let { put("method", it) }
        val failure = args.error
        if (failure != null) {
          put("error", JSObject().apply { failure.forEach { (key, value) -> put(key, value) } })
        } else {
          put("result", args.result)
        }
      }
      tab.reply(payload)
      null
    }
  }

  @Command
  fun setProvider(invoke: Invoke) {
    val args = invoke.parseArgs(ProviderArgs::class.java)
    ui(invoke) {
      val tab = tabById(args.id)
      val previousChain = tab.chainId
      val previousAccounts = tab.accounts
      val wasConnected = tab.connected

      tab.chainId = args.chainId
      tab.accounts = args.accounts ?: emptyList()
      tab.connected = args.connected && tab.accounts.isNotEmpty()
      tab.installProviderScript()

      if (!wasConnected && tab.connected) {
        tab.sendEvent("connect", JSObject().put("chainId", tab.chainId))
      }
      if (wasConnected && !tab.connected) {
        tab.sendEvent("disconnect", JSObject().put("code", 4900).put("message", "Cüzdan bağlantısı kesildi"))
      }
      if (previousChain != tab.chainId && tab.chainId != null) {
        tab.sendEvent("chainChanged", tab.chainId)
      }
      if (previousAccounts != tab.accounts) {
        tab.sendEvent("accountsChanged", tab.accounts)
      }
      null
    }
  }

  @Command
  fun clearData(invoke: Invoke) {
    ui(invoke) {
      val cookies = CookieManager.getInstance()
      cookies.removeAllCookies(null)
      cookies.flush()
      WebStorage.getInstance().deleteAllData()
      WebViewDatabase.getInstance(activity).clearFormData()
      WebViewDatabase.getInstance(activity).clearHttpAuthUsernamePassword()
      tabs.values.forEach { it.view.clearCache(true) }
      null
    }
  }

  @Command
  fun snapshot(invoke: Invoke) {
    val args = invoke.parseArgs(SnapshotArgs::class.java)
    ui(invoke) {
      val tab = tabById(args.id)
      JSObject().apply {
        put("id", args.id)
        put("image", tab.snapshot(args.width.coerceIn(120, 720)))
      }
    }
  }


  internal fun onProviderMessage(tab: DappTab, body: String, origin: String) {
    val message = try { JSObject(body) } catch (e: Exception) { return }
    val method = message.optString("method", "")
    if (method.isEmpty()) return
    dispatch("providerRequest", JSObject().apply {
      put("id", tab.id)
      put("requestId", message.optLong("id", 0))
      put("method", method)
      put("params", message.optJSONArray("params") ?: JSONArray())
      put("origin", origin)
      put("url", tab.url)
    })
  }

  internal fun dispatch(event: String, payload: JSObject) {
    if (destroyed) return
    try {
      dispatcher.execute {
        try { trigger(event, payload) } catch (e: Throwable) { }
      }
    } catch (e: RejectedExecutionException) {
    }
  }

  internal fun pickFile(callback: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean {
    fileCallback?.onReceiveValue(null)
    fileCallback = callback
    val intent = try {
      params.createIntent()
    } catch (e: Exception) {
      Intent(Intent.ACTION_GET_CONTENT).apply {
        type = "*/*"
        addCategory(Intent.CATEGORY_OPENABLE)
      }
    }
    return try {
      startActivityForResult(detachedInvoke(), Intent.createChooser(intent, "Dosya seç"), "onFilePicked")
      true
    } catch (e: Exception) {
      fileCallback = null
      false
    }
  }

  @ActivityCallback
  fun onFilePicked(invoke: Invoke, result: ActivityResult) {
    val callback = fileCallback ?: return
    fileCallback = null
    callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
  }


  private fun detachedInvoke(): Invoke = Invoke(0, "fileChooser", 0, 0, { _, _ -> }, "{}", jsonMapper())

  private fun tabById(id: String): DappTab = tabs[id] ?: throw IllegalStateException("Sekme bulunamadı")

  private fun removeTab(id: String) {
    val tab = tabs.remove(id) ?: return
    tab.destroy()
    if (activeId == id) activeId = null
    applyGeometry()
    dispatch("tabClosed", JSObject().put("id", id))
  }

  private fun applyGeometry() {
    val host = mainView ?: return
    val density = activity.resources.displayMetrics.density
    val width = (bounds.width * density).toInt()
    val height = (bounds.height * density).toInt()
    val parent = host.parent as? View
    val left = host.left - (parent?.paddingLeft ?: 0) + (bounds.x * density).toInt()
    val top = host.top - (parent?.paddingTop ?: 0) + (bounds.y * density).toInt()
    val usable = overlayVisible && width > 0 && height > 0

    tabs.forEach { (id, tab) ->
      val params = tab.view.layoutParams as? FrameLayout.LayoutParams
        ?: FrameLayout.LayoutParams(width, height)
      params.width = width.coerceAtLeast(0)
      params.height = height.coerceAtLeast(0)
      params.leftMargin = left
      params.topMargin = top
      tab.view.layoutParams = params

      val active = usable && id == activeId
      tab.view.visibility = if (usable) View.INVISIBLE else View.GONE
      if (active) {
        tab.view.visibility = View.VISIBLE
        tab.view.bringToFront()
      }
    }
  }

  private fun ui(invoke: Invoke, block: () -> JSObject?) {
    activity.runOnUiThread {
      try {
        invoke.resolve(block())
      } catch (e: Throwable) {
        invoke.reject(e.message ?: "Tarayıcı işlemi başarısız")
      }
    }
  }

  companion object {
    private const val MAX_TABS = 12
    private const val SNAPSHOT_WIDTH = 300
  }
}
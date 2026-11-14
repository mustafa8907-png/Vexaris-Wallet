-keep class com.vexaris.webview.** { *; }
-keepclassmembers class com.vexaris.webview.** {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
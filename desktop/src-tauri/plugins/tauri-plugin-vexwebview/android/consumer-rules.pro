# Eklenti JNI ile adından bulunuyor ve komutları reflection ile çağrılıyor;
# R8 bu sınıfları yeniden adlandırıp budarsa tarayıcı hiç açılmaz.
-keep class com.vexaris.webview.** { *; }
-keepclassmembers class com.vexaris.webview.** {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
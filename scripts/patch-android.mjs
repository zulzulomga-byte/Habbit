// Menyesuaikan proyek Android hasil `cap add android`. Gagal keras kalau template tidak cocok.
import fs from 'node:fs';
import path from 'node:path';

const RES = 'android/app/src/main/res';
const MAIN = 'android/app/src/main';
const fail = (m) => { console.error('PATCH ERROR: ' + m); process.exit(1); };
const read = (f) => fs.readFileSync(f, 'utf8');
const write = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };

// 1) warna + ikon adaptif ---------------------------------------------------
write(`${RES}/values/mh_colors.xml`, `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="mh_splash">#ECECF1</color>
    <color name="mh_icon_bg">#14141A</color>
    <bool name="mh_light_bars">true</bool>
</resources>
`);
write(`${RES}/values-night/mh_colors.xml`, `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="mh_splash">#0E0E11</color>
    <bool name="mh_light_bars">false</bool>
</resources>
`);
write(`${RES}/drawable/mh_icon_fg.xml`, `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
    <group android:scaleX="3.1" android:scaleY="3.1" android:translateX="16.8" android:translateY="15.56">
        <path android:pathData="M5.5,12.5l4.2,4.2L18.5,8"
            android:strokeColor="#BFEA2E" android:strokeWidth="2.6"
            android:strokeLineCap="round" android:strokeLineJoin="round" />
    </group>
</vector>
`);
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/mh_icon_bg"/>
    <foreground android:drawable="@drawable/mh_icon_fg"/>
</adaptive-icon>
`;
write(`${RES}/mipmap-anydpi-v26/ic_launcher.xml`, adaptive);
write(`${RES}/mipmap-anydpi-v26/ic_launcher_round.xml`, adaptive);

// ikon lama (API < 26): hapus bawaan Capacitor, ganti PNG kita (hindari resource ganda)
for (const d of fs.readdirSync(RES).filter((x) => x.startsWith('mipmap-') && !x.includes('anydpi'))) {
  for (const f of fs.readdirSync(path.join(RES, d))) {
    if (/^ic_launcher.*\.(png|webp)$/.test(f)) fs.rmSync(path.join(RES, d, f));
  }
  const srcDir = path.join('android-res', d);
  if (fs.existsSync(srcDir)) for (const f of fs.readdirSync(srcDir)) fs.copyFileSync(path.join(srcDir, f), path.join(RES, d, f));
}

// 2) styles.xml: tanpa edge-to-edge paksa + splash polos --------------------
const stylesPath = `${RES}/values/styles.xml`;
let styles = read(stylesPath);
const re = /(<style\s+name="AppTheme\.NoActionBar(?:Launch)?"[^>]*>)/g;
if (!re.test(styles)) fail('style AppTheme.NoActionBar tidak ditemukan di styles.xml');
styles = styles.replace(re, '$1\n        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>\n        <item name="android:statusBarColor">@color/mh_splash</item>\n        <item name="android:navigationBarColor">@color/mh_splash</item>\n        <item name="android:windowLightStatusBar">@bool/mh_light_bars</item>\n        <item name="android:windowLightNavigationBar">@bool/mh_light_bars</item>');
styles = styles.replace(/@drawable\/splash\b/g, '@color/mh_splash');
styles = styles.replace(/(<style\s+name="AppTheme\.NoActionBarLaunch"[^>]*>)/,
  '$1\n        <item name="windowSplashScreenBackground">@color/mh_splash</item>');
write(stylesPath, styles);

// 3) AndroidManifest: getar + keyboard ---------------------------------------
const manPath = `${MAIN}/AndroidManifest.xml`;
let man = read(manPath);
if (!man.includes('android.permission.VIBRATE')) {
  if (!man.includes('</manifest>')) fail('AndroidManifest tidak valid');
  man = man.replace('</manifest>', '    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>');
}
if (!/<activity\b/.test(man)) fail('<activity> tidak ditemukan di AndroidManifest');
if (/android:windowSoftInputMode=/.test(man)) man = man.replace(/android:windowSoftInputMode="[^"]*"/, 'android:windowSoftInputMode="adjustResize"');
else man = man.replace(/<activity\b/, '<activity android:windowSoftInputMode="adjustResize"');
write(manPath, man);

// 4) MainActivity: ukuran teks WebView tidak ikut skala font sistem ----------
const find = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? find(p) : (e.name === 'MainActivity.java' ? [p] : []);
});
const mains = find(`${MAIN}/java`);
if (mains.length !== 1) fail('MainActivity.java tidak ditemukan / ganda');
const pkg = (read(mains[0]).match(/^\s*package\s+([\w.]+);/m) || [])[1];
if (!pkg) fail('package MainActivity tidak terbaca');
write(mains[0], `package ${pkg};

import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import android.webkit.JavascriptInterface;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private class Bars {
        @JavascriptInterface
        public void setBars(final String hex, final boolean dark) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        int c = Color.parseColor(hex);
                        Window w = getWindow();
                        w.setStatusBarColor(c);
                        w.setNavigationBarColor(c);
                        WindowInsetsControllerCompat ctl = WindowCompat.getInsetsController(w, w.getDecorView());
                        if (ctl != null) {
                            ctl.setAppearanceLightStatusBars(!dark);
                            ctl.setAppearanceLightNavigationBars(!dark);
                        }
                    } catch (Throwable ignored) {
                    }
                }
            });
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            getBridge().getWebView().addJavascriptInterface(new Bars(), "MhNative");
        } catch (Throwable ignored) {
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        try {
            android.webkit.WebView wv = getBridge().getWebView();
            wv.getSettings().setTextZoom(100);
            wv.setVerticalScrollBarEnabled(false);
            wv.setHorizontalScrollBarEnabled(false);
        } catch (Throwable ignored) {
        }
    }
}
`);

console.log('Patch Android OK');

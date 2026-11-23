package io.github.neissa.twa;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.widget.TextView;

/**
 * Écran d'accueil (launcher) de « Mon coin ».
 *
 * L'activité de lancement de l'appli TWA ne fait que lancer Chrome puis se ferme : elle ne peut pas
 * servir d'écran d'accueil. Cette activité-ci reste ouverte en dessous de l'appli et la relance :
 * - à son ouverture ;
 * - à chaque appui sur Accueil (singleTask : l'appli repart sur sa page d'accueil, les tuiles) ;
 * - quand on revient dessus (Retour qui ferme l'appli), après un court délai : Chrome doit d'abord
 *   finir de fermer la session précédente. Au plus une fois toutes les 3 s, pour ne pas boucler.
 * L'écran affiche un gros arc-en-ciel : le toucher n'importe où rouvre l'appli.
 * Le bouton Retour ne fait rien sur cet écran (on ne sort pas de l'écran d'accueil).
 *
 * Compilée et ajoutée à l'APK par tools/apk-launcher.sh.
 */
public class HomeActivity extends Activity {
    private static final long DELAI_MS = 3000; // entre deux relances automatiques
    private static final long ATTENTE_MS = 800; // avant de relancer au retour sur cet écran
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable relance = this::lancerAppli;
    private long dernierLancement = 0;

    @Override
    protected void onCreate(Bundle etat) {
        super.onCreate(etat);
        TextView vue = new TextView(this);
        vue.setText("🌈"); // 🌈
        vue.setTextSize(120);
        vue.setGravity(Gravity.CENTER);
        vue.setBackgroundColor(0xFFBFE9FF); // bleu ciel de l'appli
        vue.setContentDescription("Mon coin");
        vue.setOnClickListener(v -> lancerAppli());
        setContentView(vue);
        lancerAppli();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        lancerAppli(); // appui sur Accueil
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (SystemClock.elapsedRealtime() - dernierLancement > DELAI_MS) {
            handler.removeCallbacks(relance);
            handler.postDelayed(relance, ATTENTE_MS);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacks(relance);
    }

    private void lancerAppli() {
        handler.removeCallbacks(relance);
        dernierLancement = SystemClock.elapsedRealtime();
        Intent app = new Intent(Intent.ACTION_MAIN);
        app.addCategory(Intent.CATEGORY_LAUNCHER);
        // Tâche de l'appli (comme un appui sur l'icône), vidée : l'appli repart sur ses tuiles.
        // L'écran d'accueil a sa propre tâche (taskAffinity dans le manifeste) : l'activité de
        // lancement de la TWA doit être la première de la sienne, sinon elle ne lance pas Chrome.
        app.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        app.setClassName(getPackageName(), "io.github.neissa.twa.LauncherActivity");
        try {
            startActivity(app);
        } catch (RuntimeException e) {
            // Appli introuvable : on reste sur cet écran plutôt que de planter
        }
    }

    @Override
    public void onBackPressed() {
        // Écran d'accueil : Retour ne fait rien
    }
}

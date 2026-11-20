import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyCzb83r863bGP0LyEFdMJ2NFbW7CQJ3cfA',
  authDomain: 'seuagendamentofacil.firebaseapp.com',
  projectId: 'seuagendamentofacil',
  storageBucket: 'seuagendamentofacil.appspot.com',
  messagingSenderId: '304909404320',
  appId: '1:304909404320:web:84a59c05743b9677f761c5'
};

export const app = initializeApp(firebaseConfig);

// Proteção contra robôs (App Check com reCAPTCHA v3). Desligada enquanto a chave estiver vazia.
// Como ligar está no README, em "Proteção contra robôs".
export const RECAPTCHA_CHAVE_SITE = '';
if (RECAPTCHA_CHAVE_SITE) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(RECAPTCHA_CHAVE_SITE),
    isTokenAutoRefreshEnabled: true
  });
}

export const db = getFirestore(app);
export const auth = getAuth(app);
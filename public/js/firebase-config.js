import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyBZqB7f5JrWwjjjzZsijDl0NPSfNAZQEJc',
  authDomain: 'agendanov.firebaseapp.com',
  projectId: 'agendanov',
  storageBucket: 'agendanov.firebasestorage.app',
  messagingSenderId: '39251128726',
  appId: '1:39251128726:web:ce19b4eae2b0efc5baedb7'
};

export const app = initializeApp(firebaseConfig);

// Proteção contra robôs (App Check com reCAPTCHA Enterprise). Desligada enquanto a chave estiver vazia.
// A chave do site não é segredo: ela fica visível na página de propósito.
// Como ligar está no README, em "Proteção contra robôs".
export const RECAPTCHA_CHAVE_SITE = '6LcaaykuAAAAAFNnCg3TuLOR0ru7hBy10Soz1yJ_';
if (RECAPTCHA_CHAVE_SITE) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_CHAVE_SITE),
    isTokenAutoRefreshEnabled: true
  });
}

export const db = getFirestore(app);
export const auth = getAuth(app);
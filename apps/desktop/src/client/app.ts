import "@desktop/client/assets/style.css";
import App from "@desktop/client/components/App.vue";
import { createSSRApp } from "vue";

export const createVueApp = () => createSSRApp(App);

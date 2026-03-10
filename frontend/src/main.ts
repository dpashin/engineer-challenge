import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { setupApollo } from './graphql/apollo';

// Import Bootstrap styles
import 'bootstrap/dist/css/bootstrap.css';

// Import custom styles
import './style.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
setupApollo(app);

app.mount('#app');

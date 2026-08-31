import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// שכבת העיצוב — סדר הייבוא חשוב: טוקנים, בסיס, ואז רכיבים.
import "./styles/tokens.css";
import "./styles/presets.css";
import "./styles/base.css";
import "./styles/components.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { BrowserOwlbearGateway, isInsideOwlbear } from "../owlbear/browser";
import { MockOwlbearGateway } from "../owlbear/mock";
import "../styles/app.css";

const mock = import.meta.env.DEV && new URLSearchParams(location.search).get("mock") === "1";
const gateway = mock ? new MockOwlbearGateway() : isInsideOwlbear() ? new BrowserOwlbearGateway() : undefined;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App gateway={gateway} />
  </StrictMode>,
);

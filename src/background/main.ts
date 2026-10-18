import { BrowserOwlbearGateway } from "../owlbear/browser";
import { startCoordinator } from "../owlbear/sync";
import { startOverlays } from "./overlays";
import OBR, { isImage } from "@owlbear-rodeo/sdk";
import { PLUGIN_ID, PENDING_TOKEN_KEY } from "../config";

async function register(): Promise<void> {
  const gateway = new BrowserOwlbearGateway();
  startCoordinator(gateway);
  startOverlays(gateway);
  const iconUrl = new URL("./action-icon.svg", window.location.href).href;
  await OBR.action.setIcon(iconUrl);
  await OBR.contextMenu.create({
    id: `${PLUGIN_ID}/open-token`,
    icons: [{
      icon: iconUrl,
      // Um item para todos: abre o cartão do token ou, para o mestre, oferece adicioná-lo.
      label: "Abrir na Rulebear",
      filter: {
        min: 1,
        max: 1,
        every: [
          { key: "type", value: "IMAGE" },
          { key: "layer", value: "CHARACTER" },
        ],
      },
    }],
    onClick: (context) => {
      const item = context.items[0];
      if (!item || !isImage(item) || item.layer !== "CHARACTER") return;
      void OBR.player
        .setMetadata({ [PENDING_TOKEN_KEY]: { tokenId: item.id, nonce: crypto.randomUUID() } })
        .then(() => OBR.action.open());
    },
  });
}

if (OBR.isAvailable) {
  if (OBR.isReady) void register();
  else OBR.onReady(() => void register());
}

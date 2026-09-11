import OBR, { isImage } from "@owlbear-rodeo/sdk";
import { PLUGIN_ID, PENDING_TOKEN_KEY } from "../config";

async function register(): Promise<void> {
  const iconUrl = new URL("./action-icon.svg", window.location.href).href;
  await OBR.action.setIcon(iconUrl);
  await OBR.contextMenu.create({
    id: `${PLUGIN_ID}/add-combatant`,
    icons: [{
      icon: iconUrl,
      label: "Adicionar à Rulebear",
      filter: {
        min: 1,
        max: 1,
        roles: ["GM"],
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

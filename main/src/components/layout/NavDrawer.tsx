import { Button, Drawer } from "@/kit";
import { Send } from "@/kit/ext";
import { t as $t } from "@/lib/i18n";
import { NavItems } from "./Sidebar";

export function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} title={$t("Menü")} side="left">
      <div className="flex h-full flex-col">
        <Button tone="brand" fullWidth href="#/send" onClick={onClose} iconLeft={<Send size={15} />}>
          {$t("Gönder")}
        </Button>
        <NavItems className="mt-4" onNavigate={onClose} />
        <div className="mt-auto pt-6 text-[10px] text-muted">v0.1.0</div>
      </div>
    </Drawer>
  );
}

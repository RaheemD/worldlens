import { useNavigate } from "react-router-dom";
import { ChevronLeft, Shield } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AnimatedPage } from "@/components/AnimatedPage";
import { Button } from "@/components/ui/button";
import { PrivacyPolicyContent } from "@/components/legal/PrivacyPolicyContent";

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <AppLayout title="Privacy Policy" hideNav>
      <AnimatedPage>
        <div className="px-4 py-6 space-y-6 pb-24 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Privacy Policy</h1>
            </div>
          </div>

          <PrivacyPolicyContent />
        </div>
      </AnimatedPage>
    </AppLayout>
  );
}

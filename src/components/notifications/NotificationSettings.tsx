import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, X, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useProfile } from "@/contexts/ProfileContext";
import { toast } from "sonner";

interface NotificationSettingsProps {
  onClose?: () => void;
}

export function NotificationSettings({ onClose }: NotificationSettingsProps) {
  const { isSupported, permission, requestPermission, showNotification } = usePushNotifications();
  const { profile, updateProfile } = useProfile();
  
  const [safetyAlerts, setSafetyAlerts] = useState(profile?.notification_preferences?.safety_alerts ?? true);
  const [tripReminders, setTripReminders] = useState(profile?.notification_preferences?.push ?? true);
  const [emailNotifications, setEmailNotifications] = useState(profile?.notification_preferences?.email ?? false);

  useEffect(() => {
    if (profile?.notification_preferences) {
      setSafetyAlerts(profile.notification_preferences.safety_alerts);
      setTripReminders(profile.notification_preferences.push);
      setEmailNotifications(profile.notification_preferences.email);
    }
  }, [profile]);

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast.success("Notifications enabled!");
      // Show a test notification
      await showNotification("Notifications Enabled", {
        body: "You'll now receive travel alerts and reminders",
      });
    } else {
      toast.error("Notification permission denied");
    }
  };

  const handleSavePreferences = async () => {
    const { error } = await updateProfile({
      notification_preferences: {
        push: tripReminders,
        email: emailNotifications,
        safety_alerts: safetyAlerts,
      },
    });

    if (error) {
      toast.error("Failed to save preferences");
    } else {
      toast.success("Preferences saved");
      onClose?.();
    }
  };

  if (!isSupported) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <BellOff className="h-5 w-5" />
            <p className="text-sm">Push notifications are not supported in this browser</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Permission Status */}
      {permission !== "granted" && (
        <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-sm">Enable Push Notifications</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Get alerts about safety updates, trip reminders, and spending insights
                </p>
                <Button
                  onClick={handleEnableNotifications}
                  className="mt-3 h-9"
                  size="sm"
                >
                  Enable Notifications
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notification Preferences */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Notification Preferences
          </CardTitle>
          <CardDescription className="text-xs">
            Choose what notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Safety Alerts</Label>
              <p className="text-xs text-muted-foreground">
                Get notified about safety concerns in your area
              </p>
            </div>
            <Switch
              checked={safetyAlerts}
              onCheckedChange={setSafetyAlerts}
              disabled={permission !== "granted"}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Trip Reminders</Label>
              <p className="text-xs text-muted-foreground">
                Reminders for upcoming trips and activities
              </p>
            </div>
            <Switch
              checked={tripReminders}
              onCheckedChange={setTripReminders}
              disabled={permission !== "granted"}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Email Updates</Label>
              <p className="text-xs text-muted-foreground">
                Receive trip summaries via email
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {profile && (
        <Button
          onClick={handleSavePreferences}
          className="w-full"
        >
          <Check className="h-4 w-4 mr-2" />
          Save Preferences
        </Button>
      )}
    </motion.div>
  );
}

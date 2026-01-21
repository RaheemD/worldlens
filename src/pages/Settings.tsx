import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, User, Bell, Globe, Palette, LogOut, Save, Loader2, Camera, X } from "lucide-react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useTheme } from "@/contexts/ThemeContext";
import { availableCurrencies, getCurrencyDisplay, getCurrencyFromCountry } from "@/lib/currency";
import { USE_LOCATION_CURRENCY } from "@/hooks/useCurrency";
import { useGeolocation } from "@/hooks/useGeolocation";
import { languages } from "@/lib/languages";
import { countries } from "@/lib/countries";
import { toast } from "sonner";
import { ContactForm } from "@/components/support/ContactForm";
import { supabase } from "@/integrations/supabase/client";

export default function Settings() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { profile, updateProfile, isLoading: profileLoading, refreshProfile } = useProfile();
  const { theme, setTheme } = useTheme();
  const { countryCode } = useGeolocation();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [hasLocalChanges, setHasLocalChanges] = useState(false); // Track if user made local changes
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [homeCurrency, setHomeCurrency] = useState(profile?.preferred_currency || "USD");
  const [preferredLanguage, setPreferredLanguage] = useState(profile?.preferred_language || "en");
  const [homeCountry, setHomeCountry] = useState(profile?.home_country || "");
  const [notifications, setNotifications] = useState(profile?.notification_preferences || {
    push: true,
    email: false,
    safety_alerts: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Swipe gesture state
  const x = useMotionValue(0);
  const opacity = useTransform(x, [0, 150], [1, 0.5]);
  const SWIPE_THRESHOLD = 100;

  // Sync local state with profile when it changes - but only if no local changes pending
  useEffect(() => {
    if (profile && !hasLocalChanges && !isUploadingAvatar) {
      setDisplayName(profile.display_name || "");
      setAvatarUrl(profile.avatar_url || "");
      setHomeCurrency(profile.preferred_currency || "USD");
      setPreferredLanguage(profile.preferred_language || "en");
      setHomeCountry(profile.home_country || "");
      setNotifications(profile.notification_preferences || {
        push: true,
        email: false,
        safety_alerts: true,
      });
    }
  }, [profile, hasLocalChanges, isUploadingAvatar]);

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const shouldNavigate = info.offset.x > SWIPE_THRESHOLD || info.velocity.x > 500;
    if (shouldNavigate) {
      animate(x, 400, { duration: 0.2 });
      setTimeout(() => navigate("/"), 150);
    } else {
      animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
    }
  };

  const getInitials = () => {
    if (displayName) {
      return displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB");
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL with cache-busting timestamp
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Add cache-busting query param to force browser to reload
      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;
      setAvatarUrl(cacheBustedUrl);

      // Persist avatar immediately so the header updates right away.
      const { error: profileError } = await updateProfile({ avatar_url: cacheBustedUrl });
      if (profileError) throw profileError;

      toast.success("Avatar updated");
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast.error("Failed to upload avatar");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setIsUploadingAvatar(true);
    try {
      setAvatarUrl("");
      const { error } = await updateProfile({ avatar_url: null });
      if (error) throw error;
      toast.success("Avatar removed");
    } catch (error) {
      console.error("Avatar remove error:", error);
      toast.error("Failed to remove avatar");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    const { error } = await updateProfile({
      display_name: displayName,
      avatar_url: avatarUrl || null,
      preferred_currency: homeCurrency,
      preferred_language: preferredLanguage,
      home_country: homeCountry,
      notification_preferences: notifications,
    });
    setIsSaving(false);

    if (error) {
      toast.error("Failed to save settings");
    } else {
      setHasLocalChanges(false); // Clear the flag after successful save
      toast.success("Settings saved successfully");
    }
  };

  const handleSignOut = async () => {
    // Navigate first to avoid ProtectedRoute redirecting to /auth
    navigate("/", { replace: true });
    await signOut();
  };

  if (profileLoading) {
    return (
      <AppLayout title="Settings">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Settings" hideNav>
      <motion.div 
        className="px-4 py-6 space-y-6 pb-24"
        style={{ x, opacity }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.5 }}
        onDragEnd={handleDragEnd}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl"
            onClick={() => navigate("/")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Profile Section */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Profile</CardTitle>
            </div>
            <CardDescription>Your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar Upload */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-20 w-20 border-2 border-primary/30">
                  <AvatarImage src={avatarUrl || undefined} alt={displayName || "User"} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xl font-medium">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                {isUploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Upload Photo
                </Button>
                {avatarUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <Separator className="bg-border/50" />

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setHasLocalChanges(true);
                }}
                placeholder="Your name"
                className="bg-background/50"
              />
            </div>
          </CardContent>
        </Card>

        {/* Preferences Section */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Preferences</CardTitle>
            </div>
            <CardDescription>Customize your travel experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Home Country</Label>
              <Select
                value={homeCountry}
                onValueChange={(v) => {
                  setHomeCountry(v);
                  setHasLocalChanges(true);
                }}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Select your home country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Preferred Currency</Label>
              <Select
                value={homeCurrency}
                onValueChange={(v) => {
                  setHomeCurrency(v);
                  setHasLocalChanges(true);
                }}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Location-based option */}
                  <SelectItem value={USE_LOCATION_CURRENCY}>
                    📍 Use location currency {countryCode ? `(${getCurrencyFromCountry(countryCode)})` : ""}
                  </SelectItem>
                  {/* All available currencies */}
                  {availableCurrencies.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {getCurrencyDisplay(currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {homeCurrency === USE_LOCATION_CURRENCY 
                  ? "Currency will change based on your GPS location"
                  : "This currency will be used for all spending tracking"
                }
              </p>
            </div>

            <div className="space-y-2">
              <Label>Preferred Language</Label>
              <Select
                value={preferredLanguage}
                onValueChange={(v) => {
                  setPreferredLanguage(v);
                  setHasLocalChanges(true);
                }}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name} ({lang.native})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Default target language for translations
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Appearance</CardTitle>
            </div>
            <CardDescription>Choose your preferred theme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {(["light", "dark", "system"] as const).map((t) => (
                <Button
                  key={t}
                  variant={theme === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme(t)}
                  className="flex-1 capitalize"
                >
                  {t}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Notifications</CardTitle>
            </div>
            <CardDescription>Manage your notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Push Notifications</Label>
                <p className="text-xs text-muted-foreground">Receive alerts on your device</p>
              </div>
              <Switch
                checked={notifications.push}
                onCheckedChange={(checked) => {
                  setNotifications({ ...notifications, push: checked });
                  setHasLocalChanges(true);
                }}
              />
            </div>
            <Separator className="bg-border/50" />
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Notifications</Label>
                <p className="text-xs text-muted-foreground">Receive updates via email</p>
              </div>
              <Switch
                checked={notifications.email}
                onCheckedChange={(checked) => {
                  setNotifications({ ...notifications, email: checked });
                  setHasLocalChanges(true);
                }}
              />
            </div>
            <Separator className="bg-border/50" />
            <div className="flex items-center justify-between">
              <div>
                <Label>Safety Alerts</Label>
                <p className="text-xs text-muted-foreground">Get notified about safety concerns</p>
              </div>
              <Switch
                checked={notifications.safety_alerts}
                onCheckedChange={(checked) => {
                  setNotifications({ ...notifications, safety_alerts: checked });
                  setHasLocalChanges(true);
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button
          onClick={handleSaveProfile}
          disabled={isSaving}
          className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90"
        >
          {isSaving ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <Save className="h-5 w-5 mr-2" />
          )}
          Save Changes
        </Button>

        {/* Contact Support */}
        <ContactForm 
          userEmail={user?.email} 
          userName={profile?.display_name || undefined} 
        />

        {/* Sign Out */}
        <Button
          variant="outline"
          onClick={handleSignOut}
          className="w-full h-12 rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5 mr-2" />
          Sign Out
        </Button>
      </motion.div>
    </AppLayout>
  );
}

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

interface NotificationPreferences {
  push: boolean;
  email: boolean;
  safety_alerts: boolean;
}

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  home_country: string | null;
  preferred_language: string;
  preferred_currency: string;
  notification_preferences: NotificationPreferences;
  created_at: string;
  updated_at: string;
}

interface ProfileContextType {
  profile: Profile | null;
  isLoading: boolean;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

const defaultNotificationPreferences: NotificationPreferences = {
  push: true,
  email: false,
  safety_alerts: true,
};

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      const notifPrefs = data.notification_preferences as Record<string, unknown> | null;
      setProfile({
        ...data,
        notification_preferences: notifPrefs ? {
          push: Boolean(notifPrefs.push),
          email: Boolean(notifPrefs.email),
          safety_alerts: Boolean(notifPrefs.safety_alerts),
        } : defaultNotificationPreferences,
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const updateProfile = async (updates: Partial<Profile>): Promise<{ error: Error | null }> => {
    if (!user) return { error: new Error("Not authenticated") };

    try {
      // Optimistic UI update so header/avatar updates immediately.
      setProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...updates,
          notification_preferences:
            updates.notification_preferences ?? prev.notification_preferences,
        };
      });

      // Convert notification_preferences to a plain object for Supabase
      const dbUpdates: Record<string, unknown> = { ...updates };
      if (updates.notification_preferences) {
        dbUpdates.notification_preferences = {
          push: updates.notification_preferences.push,
          email: updates.notification_preferences.email,
          safety_alerts: updates.notification_preferences.safety_alerts,
        };
      }
      
      const { error } = await supabase
        .from("profiles")
        .update(dbUpdates)
        .eq("user_id", user.id);

      if (error) throw error;

      await fetchProfile();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  return (
    <ProfileContext.Provider value={{ profile, isLoading, updateProfile, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}

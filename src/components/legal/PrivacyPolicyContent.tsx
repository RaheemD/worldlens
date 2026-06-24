// Single source of truth for the privacy policy.
// Rendered both on the standalone /privacy page and inside the Settings modal.

// Update these two values as needed.
export const PRIVACY_CONTACT_EMAIL = "info@appfinityaistudio.com";
export const PRIVACY_LAST_UPDATED = "June 24, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function PrivacyPolicyContent() {
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">Last updated: {PRIVACY_LAST_UPDATED}</p>

      <p className="text-sm leading-relaxed text-muted-foreground">
        WorldLens ("we", "our", or "the app") is an AI-powered travel companion for scanning,
        translating, planning trips, tracking spending, and exploring. This Privacy Policy explains
        what information we collect, how we use it, and the choices you have. By using WorldLens you
        agree to this policy.
      </p>

      <Section title="1. Information We Collect">
        <p>We collect only what is needed to provide the app's features:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account information:</strong> when you sign up, your email address and (if you
            choose) your display name. If you sign in with Google, we receive your basic Google
            profile (name, email, profile photo).
          </li>
          <li>
            <strong>Profile &amp; preferences:</strong> display name, profile photo, home country,
            preferred language, preferred currency, and notification preferences.
          </li>
          <li>
            <strong>Content you create:</strong> photos you scan, AI analysis results, extracted
            text, saved journal entries, trips, and spending records you add.
          </li>
          <li>
            <strong>Location data:</strong> with your permission, your approximate or precise device
            location, used to show local information and tag scans. If you decline, we may estimate
            your general location from your IP address.
          </li>
          <li>
            <strong>Camera &amp; images:</strong> images you capture or upload for scanning and
            receipt analysis.
          </li>
          <li>
            <strong>Usage data:</strong> a daily counter of AI feature usage to enforce fair-use
            limits.
          </li>
        </ul>
      </Section>

      <Section title="2. How We Use Your Information">
        <ul className="list-disc space-y-1 pl-5">
          <li>To provide and operate the app's features (scanning, translation, trip planning, safety info, spending tracking).</li>
          <li>To store your journal, trips, and preferences so they are available across sessions.</li>
          <li>To personalize content such as local currency and language.</li>
          <li>To maintain security and prevent abuse of AI features.</li>
        </ul>
        <p>We do not sell your personal information, and we do not use it for advertising.</p>
      </Section>

      <Section title="3. AI Processing">
        <p>
          When you use AI features (image scanning, translation, receipt scanning, trip planning,
          safety information, and trip summaries), the relevant text or image is sent to our AI
          provider, <strong>OpenRouter</strong>, to generate a response. Images and text are
          processed to produce results and are not used by us to build advertising profiles.
        </p>
      </Section>

      <Section title="4. Third-Party Services">
        <p>We rely on the following service providers to operate the app:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Supabase</strong> — authentication, database, and file storage for your account and content.</li>
          <li><strong>OpenRouter</strong> — AI processing of images and text for app features.</li>
          <li><strong>Google</strong> — optional Google sign-in (OAuth).</li>
          <li><strong>OpenStreetMap (Nominatim)</strong> — converting GPS coordinates into place names.</li>
          <li><strong>Frankfurter</strong> — currency exchange rates.</li>
          <li><strong>ipapi</strong> — approximate location from IP address when device location is unavailable.</li>
        </ul>
        <p>
          Each provider processes data under its own privacy policy. We share only the minimum data
          necessary for each feature to work.
        </p>
      </Section>

      <Section title="5. Location Data">
        <p>
          Location is used only while you use location-aware features. You can disable location
          access at any time in your device or browser settings; some features may then be limited.
        </p>
      </Section>

      <Section title="6. Notifications">
        <p>
          With your permission, the app can show notifications (for example, safety alerts and trip
          reminders). You can turn notifications on or off at any time in Settings or in your device
          settings.
        </p>
      </Section>

      <Section title="7. Data Retention &amp; Your Choices">
        <ul className="list-disc space-y-1 pl-5">
          <li>You can delete individual scans, trips, and spending records within the app at any time.</li>
          <li>You can update your profile and preferences in Settings.</li>
          <li>
            You can permanently delete your account and all associated data at any time from{" "}
            <strong>Settings &rarr; Legal &rarr; Delete Account</strong>. You may also email us to
            request deletion. Account deletion is immediate and cannot be undone.
          </li>
        </ul>
      </Section>

      <Section title="8. Data Security">
        <p>
          We use industry-standard measures to protect your data, including encrypted connections
          (HTTPS) and access controls that restrict your data to your own account. No method of
          transmission or storage is completely secure, but we work to protect your information.
        </p>
      </Section>

      <Section title="9. Children's Privacy">
        <p>
          WorldLens is not directed to children under 13 (or the minimum age required in your
          country), and we do not knowingly collect their personal information. If you believe a
          child has provided us data, please contact us and we will delete it.
        </p>
      </Section>

      <Section title="10. International Users">
        <p>
          Your information may be processed and stored on servers located in countries other than
          your own. By using the app, you consent to this transfer and processing.
        </p>
      </Section>

      <Section title="11. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. We will revise the "Last updated" date
          above when we do. Continued use of the app after changes means you accept the updated policy.
        </p>
      </Section>

      <Section title="12. Contact Us">
        <p>
          If you have questions about this Privacy Policy or your data, contact us at{" "}
          <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="text-primary hover:underline">
            {PRIVACY_CONTACT_EMAIL}
          </a>
        </p>
      </Section>
    </div>
  );
}

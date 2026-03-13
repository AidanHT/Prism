"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/store/useAuthStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { User, Upload } from "lucide-react";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
];

const profileSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  email: z.string().email(),
  bio: z.string().max(500, "Bio cannot exceed 500 characters").optional(),
  timezone: z.string().min(1, "Please select a timezone"),
  language: z.string().min(1, "Please select a language"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.name ?? "",
      email: user?.email ?? "",
      bio: "",
      timezone: "America/New_York",
      language: "en",
    },
  });

  const bio = watch("bio") ?? "";

  function onSubmit(_data: ProfileFormValues) {
    // In real app: call FastAPI PATCH /users/me
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        toast.success("Profile updated successfully.");
        resolve();
      }, 600),
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage your personal information</p>
      </div>

      {/* Avatar section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Profile Picture</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            {/* Avatar display */}
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary shrink-0">
              {user?.name?.charAt(0) ?? <User className="h-8 w-8" />}
            </div>
            {/* Dropzone stub */}
            <div className="flex-1 border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-sm text-muted-foreground">
                Drop an image here or{" "}
                <span className="text-primary font-medium">click to browse</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG up to 5 MB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="displayName">
                Display Name
              </label>
              <Input
                id="displayName"
                placeholder="Your full name"
                {...register("displayName")}
              />
              {errors.displayName && (
                <p className="text-xs text-destructive">{errors.displayName.message}</p>
              )}
            </div>

            {/* Email (read-only) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                disabled
                className="opacity-60 cursor-not-allowed"
                {...register("email")}
              />
              <p className="text-xs text-muted-foreground">Contact your administrator to change your email.</p>
            </div>

            <Separator />

            {/* Bio */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" htmlFor="bio">
                  Bio
                </label>
                <span className="text-xs text-muted-foreground">{bio.length}/500</span>
              </div>
              <textarea
                id="bio"
                rows={4}
                placeholder="Tell your students or colleagues a bit about yourself…"
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("bio")}
              />
              {errors.bio && (
                <p className="text-xs text-destructive">{errors.bio.message}</p>
              )}
            </div>

            <Separator />

            {/* Timezone & Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="timezone">
                  Timezone
                </label>
                <select
                  id="timezone"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register("timezone")}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
                {errors.timezone && (
                  <p className="text-xs text-destructive">{errors.timezone.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="language">
                  Language
                </label>
                <select
                  id="language"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register("language")}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
                {errors.language && (
                  <p className="text-xs text-destructive">{errors.language.message}</p>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={!isDirty || isSubmitting}>
                {isSubmitting ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

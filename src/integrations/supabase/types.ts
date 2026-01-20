export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      downloads: {
        Row: {
          artist: string | null
          downloaded_at: string | null
          duration: string | null
          id: string
          thumbnail_url: string | null
          title: string
          user_id: string
          video_id: string
        }
        Insert: {
          artist?: string | null
          downloaded_at?: string | null
          duration?: string | null
          id?: string
          thumbnail_url?: string | null
          title: string
          user_id: string
          video_id: string
        }
        Update: {
          artist?: string | null
          downloaded_at?: string | null
          duration?: string | null
          id?: string
          thumbnail_url?: string | null
          title?: string
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          artist: string | null
          created_at: string | null
          duration: string | null
          id: string
          thumbnail_url: string | null
          title: string
          user_id: string
          video_id: string
        }
        Insert: {
          artist?: string | null
          created_at?: string | null
          duration?: string | null
          id?: string
          thumbnail_url?: string | null
          title: string
          user_id: string
          video_id: string
        }
        Update: {
          artist?: string | null
          created_at?: string | null
          duration?: string | null
          id?: string
          thumbnail_url?: string | null
          title?: string
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          status: string
          to_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          status?: string
          to_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          status?: string
          to_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      jam_participants: {
        Row: {
          id: string
          jam_session_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          id?: string
          jam_session_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          id?: string
          jam_session_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jam_participants_jam_session_id_fkey"
            columns: ["jam_session_id"]
            isOneToOne: false
            referencedRelation: "jam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      jam_sessions: {
        Row: {
          created_at: string
          current_track_data: Json | null
          current_track_id: string | null
          host_user_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_track_data?: Json | null
          current_track_id?: string | null
          host_user_id: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_track_data?: Json | null
          current_track_id?: string | null
          host_user_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          from_user_id: string
          id: string
          read: boolean
          to_user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          from_user_id: string
          id?: string
          read?: boolean
          to_user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          from_user_id?: string
          id?: string
          read?: boolean
          to_user_id?: string
        }
        Relationships: []
      }
      playlist_songs: {
        Row: {
          artist: string | null
          created_at: string | null
          duration: string | null
          id: string
          playlist_id: string
          position: number
          thumbnail_url: string | null
          title: string
          video_id: string
        }
        Insert: {
          artist?: string | null
          created_at?: string | null
          duration?: string | null
          id?: string
          playlist_id: string
          position?: number
          thumbnail_url?: string | null
          title: string
          video_id: string
        }
        Update: {
          artist?: string | null
          created_at?: string | null
          duration?: string | null
          id?: string
          playlist_id?: string
          position?: number
          thumbnail_url?: string | null
          title?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_songs_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_url: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      recently_played: {
        Row: {
          artist: string | null
          duration: string | null
          id: string
          played_at: string | null
          thumbnail_url: string | null
          title: string
          user_id: string
          video_id: string
        }
        Insert: {
          artist?: string | null
          duration?: string | null
          id?: string
          played_at?: string | null
          thumbnail_url?: string | null
          title: string
          user_id: string
          video_id: string
        }
        Update: {
          artist?: string | null
          duration?: string | null
          id?: string
          played_at?: string | null
          thumbnail_url?: string | null
          title?: string
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          current_track_data: Json | null
          current_track_id: string | null
          id: string
          is_playing: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          current_track_data?: Json | null
          current_track_id?: string | null
          id?: string
          is_playing?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          current_track_data?: Json | null
          current_track_id?: string | null
          id?: string
          is_playing?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

CREATE TABLE "sanotalk_connection_request" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "from_user_id" text NOT NULL REFERENCES "sanotalk_user"("id") ON DELETE CASCADE,
  "to_user_id"   text NOT NULL REFERENCES "sanotalk_user"("id") ON DELETE CASCADE,
  "type"         text NOT NULL,
  "status"       text NOT NULL DEFAULT 'pending',
  "created_at"   timestamp NOT NULL DEFAULT now(),
  "updated_at"   timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "connection_request_from_to_type_uniq"
  ON "sanotalk_connection_request" ("from_user_id","to_user_id","type");

import { Link } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Calendar, Video } from "lucide-react";
import { cn } from "../../lib/utils";
import { TalkSession } from "@sanotalk/db";
import { useTranslation } from "react-i18next";

type Props = {
  session: TalkSession
}

const statusColors = {
  scheduled: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
} as const;


export function SessionCard({ session }: Props) {
  const { t } = useTranslation("sessions");
  return (
    <Link to="/sessions/$sessionId" params={{ sessionId: session.id }}>
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-2 group-hover:text-primary transition-colors">
              {session.hostId}
            </CardTitle>
            <Badge
              variant="secondary"
              className={cn(
                "shrink-0 capitalize",
                statusColors[session.status]
              )}
            >
              {t(`card.statuses.${session.status}`)}
            </Badge>
          </div>
          <CardDescription className="text-xs truncate">
            {session.roomName}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          {session.scheduledAt && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(session.scheduledAt).toLocaleString()}
            </div>
          )}
          {session.status === "active" && (
            <div className="flex items-center gap-1 text-green-600 font-medium">
              <Video className="h-3 w-3 animate-pulse" />
              {t("card.liveNow")}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

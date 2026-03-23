import { z } from "zod";
export declare const transcriptsRouter: import("@trpc/server").TRPCBuiltRouter<{
    ctx: {
        db: import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof import("@sanotalk/db/schema")> & {
            $client: import("postgres").Sql<{}>;
        };
        session: {
            session: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined | undefined;
                userAgent?: string | null | undefined | undefined;
            };
            user: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined | undefined;
            };
        } | null;
        user: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined | undefined;
        } | null;
        req: import("http").IncomingMessage;
        res: import("http").ServerResponse<import("http").IncomingMessage>;
    };
    meta: object;
    errorShape: {
        data: {
            zodError: z.typeToFlattenedError<any, string> | null;
            code: import("@trpc/server").TRPC_ERROR_CODE_KEY;
            httpStatus: number;
            path?: string;
            stack?: string;
        };
        message: string;
        code: import("@trpc/server").TRPC_ERROR_CODE_NUMBER;
    };
    transformer: true;
}, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
    bySession: import("@trpc/server").TRPCQueryProcedure<{
        input: {
            sessionId: string;
        };
        output: {
            id: string;
            createdAt: Date;
            sessionId: string;
            speakerId: string | null;
            speakerLabel: string | null;
            content: string;
            confidence: number | null;
            startMs: number | null;
            endMs: number | null;
            rawDeepgramResult: unknown;
            speaker: never;
        }[];
        meta: object;
    }>;
    summaryBySession: import("@trpc/server").TRPCQueryProcedure<{
        input: {
            sessionId: string;
        };
        output: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            sessionId: string;
            summary: string;
            keyPoints: string[] | null;
            actionItems: string[] | null;
            soapNote: {
                subjective: string;
                objective: string;
                assessment: string;
                plan: string;
            } | null;
        } | undefined;
        meta: object;
    }>;
    save: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            sessionId: string;
            content: string;
            speakerId?: string | undefined;
            speakerLabel?: string | undefined;
            confidence?: number | undefined;
            startMs?: number | undefined;
            endMs?: number | undefined;
            rawDeepgramResult?: unknown;
        };
        output: {
            id: string;
            createdAt: Date;
            sessionId: string;
            speakerId: string | null;
            speakerLabel: string | null;
            content: string;
            confidence: number | null;
            startMs: number | null;
            endMs: number | null;
            rawDeepgramResult: unknown;
        } | undefined;
        meta: object;
    }>;
}>>;
//# sourceMappingURL=transcripts.d.ts.map
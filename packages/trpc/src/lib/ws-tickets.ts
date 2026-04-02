import { randomUUID } from "crypto";

interface Ticket {
  userId: string;
  expiresAt: number;
}

const tickets = new Map<string, Ticket>();

const TICKET_TTL_MS = 30_000; // 30 seconds

export function issueTicket(userId: string): string {
  const id = randomUUID();
  tickets.set(id, { userId, expiresAt: Date.now() + TICKET_TTL_MS });
  return id;
}

export function consumeTicket(ticketId: string): string | null {
  const ticket = tickets.get(ticketId);
  if (!ticket) return null;
  tickets.delete(ticketId);
  if (Date.now() > ticket.expiresAt) return null;
  return ticket.userId;
}

// Periodic cleanup of expired tickets
setInterval(() => {
  const now = Date.now();
  for (const [id, ticket] of tickets) {
    if (now > ticket.expiresAt) tickets.delete(id);
  }
}, 60_000);

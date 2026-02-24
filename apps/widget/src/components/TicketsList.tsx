import type { Id } from "@opencom/convex/dataModel";
import { Ticket } from "../icons";
import { formatTime } from "../utils/format";

interface TicketItem {
  _id: Id<"tickets">;
  subject: string;
  status: string;
  createdAt: number;
}

interface TicketsListProps {
  tickets: TicketItem[] | undefined;
  onSelectTicket: (id: Id<"tickets">) => void;
}

export function TicketsList({ tickets, onSelectTicket }: TicketsListProps) {
  return (
    <div className="opencom-tickets-list">
      {tickets && tickets.length > 0 ? (
        tickets.map((ticket) => (
          <button
            key={ticket._id}
            className="opencom-ticket-item"
            onClick={() => onSelectTicket(ticket._id)}
          >
            <div className="opencom-ticket-icon">
              <Ticket />
            </div>
            <div className="opencom-ticket-content">
              <span className="opencom-ticket-subject">{ticket.subject}</span>
              <div className="opencom-ticket-meta">
                <span className={`opencom-ticket-status opencom-ticket-status-${ticket.status}`}>
                  {ticket.status}
                </span>
                <span className="opencom-ticket-time">{formatTime(ticket.createdAt)}</span>
              </div>
            </div>
          </button>
        ))
      ) : (
        <div className="opencom-empty-list">
          <div className="opencom-empty-icon">
            <Ticket />
          </div>
          <h3>No Tickets</h3>
          <p>You don&apos;t have any support tickets yet.</p>
        </div>
      )}
    </div>
  );
}

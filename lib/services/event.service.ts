"use server";
import Event from "@/lib/database/models/event.model";
import { fetchOrganizerDetails } from "../actions/event.actions";

/**
 * Fetches a list of events and enriches them with organizer details.
 *  A list of events with organizer details.
 */
export async function getEventsWithOrganizerDetails() {
  try {
    const events = await Event.find({}).populate("category");

    const joinedEvents = await Promise.all(
      events.map(async (ev) => ({
        ...ev.toObject(),
        _id: ev._id.toString(), // Convert _id to string
        category: {
          ...ev.category.toObject(),
          _id: ev.category._id.toString(), // Convert category _id to string
        },
        organizer: await fetchOrganizerDetails(ev.organizer), // Fetch full organizer details
      }))
    );

    return joinedEvents;
  } catch (error) {
    console.error("Failed to fetch events with organizer details:", error);
    throw error;
  }
}

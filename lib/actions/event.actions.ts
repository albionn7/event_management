"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database";
import Event from "@/lib/database/models/event.model";
import Category from "@/lib/database/models/category.model";
import { handleError } from "@/lib/utils";
import { auth } from "@clerk/nextjs/server"; // Import Clerk's auth function

import {
  CreateEventParams,
  UpdateEventParams,
  DeleteEventParams,
  GetAllEventsParams,
  GetEventsByUserParams,
  GetRelatedEventsByCategoryParams,
} from "@/types";

const getCategoryByName = async (name: string) => {
  return Category.findOne({ name: { $regex: name, $options: "i" } });
};

// Populate only the category field (since there's no User table)
const populateEvent = (query: any) => {
  return query.populate({
    path: "category",
    model: Category,
    select: "name", // Include only the necessary fields
  });
};

// CREATE
export async function createEvent({ userId, event, path }: CreateEventParams) {
  try {
    await connectToDatabase();

    // Create the event with the userId (Clerk ID) as the organizer
    const newEvent = await Event.create({
      ...event,
      category: event.categoryId,
      organizer: userId, // Store the Clerk ID
    });

    // Fetch organizer details right after event creation
    const organizerDetails = await fetchOrganizerDetails(userId);

    revalidatePath(path);

    return JSON.parse(
      JSON.stringify({
        ...newEvent.toObject(),
        organizer: organizerDetails, // Return full organizer details
      })
    );
  } catch (error) {
    handleError(error);
  }
}

// GET ONE EVENT BY ID
export async function getEventById(eventId: string) {
  try {
    await connectToDatabase();

    const event = await Event.findById(eventId).populate("category");
    if (!event) throw new Error("Event not found");

    const organizerDetails = await fetchOrganizerDetails(event.organizer);

    return {
      ...event.toObject(),
      _id: event._id.toString(),
      category: {
        ...event.category.toObject(),
        _id: event.category._id.toString(),
      },
      organizer: organizerDetails,
    };
  } catch (error) {
    console.error("Failed to fetch event by ID:", error);
    throw error;
  }
}

// UPDATE
export async function updateEvent({ userId, event, path }: UpdateEventParams) {
  try {
    await connectToDatabase();

    const eventToUpdate = await Event.findById(event._id);
    if (!eventToUpdate || eventToUpdate.organizer !== userId) {
      throw new Error("Unauthorized or event not found");
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      event._id,
      { ...event, category: event.categoryId },
      { new: true }
    );
    revalidatePath(path);

    return JSON.parse(JSON.stringify(updatedEvent));
  } catch (error) {
    handleError(error);
  }
}

// DELETE
export async function deleteEvent({ eventId, path }: DeleteEventParams) {
  try {
    await connectToDatabase();

    const deletedEvent = await Event.findByIdAndDelete(eventId);
    if (deletedEvent) revalidatePath(path);
  } catch (error) {
    handleError(error);
  }
}

// // GET ALL EVENTS
// export async function getAllEvents({
//   query,
//   limit = 6,
//   page,
//   category,
// }: GetAllEventsParams) {
//   try {
//     await connectToDatabase();

//     const titleCondition = query
//       ? { title: { $regex: query, $options: "i" } }
//       : {};
//     const categoryCondition = category
//       ? await getCategoryByName(category)
//       : null;
//     const conditions = {
//       $and: [
//         titleCondition,
//         categoryCondition ? { category: categoryCondition._id } : {},
//       ],
//     };

//     const skipAmount = (Number(page) - 1) * limit;
//     const eventsQuery = Event.find(conditions)
//       .sort({ createdAt: "desc" })
//       .skip(skipAmount)
//       .limit(limit);

//     const events = await populateEvent(eventsQuery);
//     const eventsCount = await Event.countDocuments(conditions);

//     return {
//       data: JSON.parse(JSON.stringify(events)),
//       totalPages: Math.ceil(eventsCount / limit),
//     };
//   } catch (error) {
//     handleError(error);
//   }
// }

export async function getAllEvents({
  query,
  limit = 6,
  page,
  category,
}: GetAllEventsParams) {
  try {
    await connectToDatabase();

    const titleCondition = query
      ? { title: { $regex: query, $options: "i" } }
      : {};
    const categoryCondition = category
      ? await getCategoryByName(category)
      : null;
    const conditions = {
      $and: [
        titleCondition,
        categoryCondition ? { category: categoryCondition._id } : {},
      ],
    };

    const skipAmount = (Number(page) - 1) * limit;
    const eventsQuery = Event.find(conditions)
      .sort({ createdAt: "desc" })
      .skip(skipAmount)
      .limit(limit);

    let events = await populateEvent(eventsQuery);

    // Fetch organizer details for each event
    const enrichedEvents = await Promise.all(
      events.map(async (event: typeof Event.prototype) => ({
        ...event.toObject(),
        organizer: await fetchOrganizerDetails(event.organizer),
      }))
    );

    const eventsCount = await Event.countDocuments(conditions);

    return {
      data: JSON.parse(JSON.stringify(enrichedEvents)),
      totalPages: Math.ceil(eventsCount / limit),
    };
  } catch (error) {
    handleError(error);
  }
}

// GET EVENTS BY ORGANIZER
export async function getEventsByUser({
  userId,
  limit = 6,
  page,
}: GetEventsByUserParams) {
  try {
    await connectToDatabase();

    const conditions = { organizer: userId };
    const skipAmount = (page - 1) * limit;

    const eventsQuery = Event.find(conditions)
      .sort({ createdAt: "desc" })
      .skip(skipAmount)
      .limit(limit);

    const events = await populateEvent(eventsQuery);
    const eventsCount = await Event.countDocuments(conditions);

    return {
      data: JSON.parse(JSON.stringify(events)),
      totalPages: Math.ceil(eventsCount / limit),
    };
  } catch (error) {
    handleError(error);
  }
}

// GET RELATED EVENTS: EVENTS WITH SAME CATEGORY
export async function getRelatedEventsByCategory({
  categoryId,
  eventId,
  limit = 3,
  page = 1,
}: GetRelatedEventsByCategoryParams) {
  try {
    await connectToDatabase();

    const skipAmount = (Number(page) - 1) * limit;
    const conditions = {
      $and: [{ category: categoryId }, { _id: { $ne: eventId } }],
    };

    const eventsQuery = Event.find(conditions)
      .sort({ createdAt: "desc" })
      .skip(skipAmount)
      .limit(limit);

    const events = await populateEvent(eventsQuery);
    const eventsCount = await Event.countDocuments(conditions);

    return {
      data: JSON.parse(JSON.stringify(events)),
      totalPages: Math.ceil(eventsCount / limit),
    };
  } catch (error) {
    handleError(error);
  }
}

// Helper function to fetch organizer details from Clerk
export async function fetchOrganizerDetails(clerkId: string) {
  const response = await fetch(`https://api.clerk.dev/v1/users/${clerkId}`, {
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch organizer details");
  }

  const user = await response.json();
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email_addresses[0].email_address,
    profileImageUrl: user.profile_image_url,
  };
}

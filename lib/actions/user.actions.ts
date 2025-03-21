"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database";
import Order from "@/lib/database/models/order.model";
import Event from "@/lib/database/models/event.model";
import { handleError } from "@/lib/utils";

// Since users are managed by Clerk, we don't need to create/update/delete users in MongoDB.
// Instead, we'll handle user-related operations using Clerk's API.

// Unlink relationships when a user is deleted (e.g., via Clerk's webhooks)
export async function handleUserDeletion(clerkId: string) {
  try {
    await connectToDatabase();

    // Find events and orders associated with the user (if any)
    const events = await Event.find({ organizer: clerkId });
    const orders = await Order.find({ buyer: clerkId });

    // Unlink the user from events and orders
    await Promise.all([
      Event.updateMany(
        { _id: { $in: events.map((event) => event._id) } },
        { $unset: { organizer: 1 } } // Remove the organizer field
      ),
      Order.updateMany(
        { _id: { $in: orders.map((order) => order._id) } },
        { $unset: { buyer: "deleted_user" } } // Remove the buyer field
      ),
    ]);

    console.log(
      `✅ Successfully unlinked user ${clerkId} from events and orders`
    );
  } catch (error) {
    console.error("❌ Error handling user deletion:", error);
    handleError(error);
  }
}

// Fetch user details from Clerk (if needed)
export async function fetchUserDetails(clerkId: string) {
  try {
    const response = await fetch(`https://api.clerk.dev/v1/users/${clerkId}`, {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user details from Clerk");
    }

    const user = await response.json();
    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email_addresses[0].email_address,
      profileImageUrl: user.profile_image_url,
    };
  } catch (error) {
    console.error("❌ Error fetching user details from Clerk:", error);
    handleError(error);
  }
}

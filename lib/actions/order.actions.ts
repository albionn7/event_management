"use server";

import Stripe from "stripe";
import {
  CheckoutOrderParams,
  CreateOrderParams,
  GetOrdersByEventParams,
  GetOrdersByUserParams,
} from "@/types";
import { redirect } from "next/navigation";
import { handleError } from "../utils";
import { connectToDatabase } from "../database";
import Order from "../database/models/order.model";
import Event from "../database/models/event.model";
import { ObjectId } from "mongodb";

// Initialize Stripe

// CHECKOUT ORDER

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("❌ STRIPE_SECRET_KEY is missing in environment variables.");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia" as any,
});

// CHECKOUT ORDER
// CHECKOUT ORDER
export const checkoutOrder = async (order: CheckoutOrderParams) => {
  const price = order.isFree ? 0 : Number(order.price) * 100;

  try {
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: price,
            product_data: {
              name: order.eventTitle,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        eventId: order.eventId,
        buyerId: order.buyerId,
      },
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/profile`,
      cancel_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/`,
    });

    return { id: session.id, url: session.url }; // ✅ Now returns session ID & URL
  } catch (error) {
    throw error;
  }
};

// CREATE ORDER
export const createOrder = async (order: CreateOrderParams) => {
  try {
    await connectToDatabase();

    const newOrder = await Order.create({
      ...order,
      event: order.eventId,
      buyer: order.buyerId, // Store clerkId as buyer
    });

    return JSON.parse(JSON.stringify(newOrder));
  } catch (error) {
    handleError(error);
  }
};

// GET ORDERS BY EVENT
export async function getOrdersByEvent({
  searchString,
  eventId,
}: GetOrdersByEventParams) {
  try {
    await connectToDatabase();

    if (!eventId) throw new Error("Event ID is required");
    const eventObjectId = new ObjectId(eventId);

    const orders = await Order.aggregate([
      {
        $match: { event: eventObjectId }, // Match orders for the event
      },
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "event",
        },
      },
      {
        $unwind: "$event",
      },
      {
        $project: {
          _id: 1,
          totalAmount: 1,
          createdAt: 1,
          eventTitle: "$event.title",
          eventId: "$event._id",
          buyerId: "$buyer", // Include buyerId (clerkId)
        },
      },
      {
        $match: {
          buyerId: { $regex: RegExp(searchString, "i") }, // Filter by buyerId
        },
      },
    ]);

    // Fetch buyer details from Clerk for each order
    const ordersWithBuyerDetails = await Promise.all(
      orders.map(async (order) => {
        const buyerDetails = await fetchUserDetails(order.buyerId);
        return {
          ...order,
          buyer: `${buyerDetails.firstName} ${buyerDetails.lastName}`,
        };
      })
    );

    return JSON.parse(JSON.stringify(ordersWithBuyerDetails));
  } catch (error) {
    handleError(error);
  }
}

// GET ORDERS BY USER
export async function getOrdersByUser({
  userId,
  limit = 3,
  page,
}: GetOrdersByUserParams) {
  try {
    await connectToDatabase();

    const skipAmount = (Number(page) - 1) * limit;
    const conditions = { buyer: userId }; // Use clerkId as buyer

    const orders = await Order.find(conditions)
      .sort({ createdAt: "desc" })
      .skip(skipAmount)
      .limit(limit)
      .populate({
        path: "event",
        model: Event,
        select: "title organizer", // Include event title and organizer
      });

    const ordersCount = await Order.countDocuments(conditions);

    // Fetch organizer details from Clerk for each event
    const ordersWithOrganizerDetails = await Promise.all(
      orders.map(async (order) => {
        const organizerDetails = await fetchUserDetails(order.event.organizer);
        return {
          ...order.toObject(),
          event: {
            ...order.event.toObject(),
            organizer: organizerDetails,
          },
        };
      })
    );

    return {
      data: JSON.parse(JSON.stringify(ordersWithOrganizerDetails)),
      totalPages: Math.ceil(ordersCount / limit),
    };
  } catch (error) {
    handleError(error);
  }
}

// Helper function to fetch user details from Clerk
async function fetchUserDetails(clerkId: string) {
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
    throw error;
  }
}

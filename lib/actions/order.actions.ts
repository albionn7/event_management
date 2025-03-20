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
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Creates a Stripe checkout session for an order.
 * @param order - Order details for checkout.
 */
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
        eventId: order.eventId, // Event ID (string or ObjectId)
        buyerId: order.buyerId, // Clerk user ID (string)
      },
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/profile`,
      cancel_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/`,
    });

    redirect(session.url!); // Redirect to Stripe checkout page
  } catch (error) {
    throw error;
  }
};

/**
 * Creates a new order in the database.
 * @param order - Order details to create.
 * @returns The created order.
 */
export const createOrder = async (order: CreateOrderParams) => {
  try {
    await connectToDatabase();

    const newOrder = await Order.create({
      ...order,
      event: order.eventId, // Event ID (string or ObjectId)
      buyer: order.buyerId, // Clerk user ID (string)
    });

    return JSON.parse(JSON.stringify(newOrder));
  } catch (error) {
    handleError(error);
  }
};

/**
 * Fetches orders for a specific event.
 * @param searchString - Search string to filter orders by buyer.
 * @param eventId - ID of the event to fetch orders for.
 * @returns A list of orders for the event.
 */
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
          buyerId: "$buyer", // Clerk user ID (string)
        },
      },
      {
        $match: {
          $and: [
            { eventId: eventObjectId },
            { buyerId: { $regex: RegExp(searchString, "i") } }, // Search by buyerId
          ],
        },
      },
    ]);

    return JSON.parse(JSON.stringify(orders));
  } catch (error) {
    handleError(error);
  }
}

/**
 * Fetches orders for a specific user.
 * @param userId - Clerk user ID to fetch orders for.
 * @param limit - Number of orders to fetch per page.
 * @param page - Page number for pagination.
 * @returns A list of orders for the user.
 */
export async function getOrdersByUser({
  userId,
  limit = 3,
  page,
}: GetOrdersByUserParams) {
  try {
    await connectToDatabase();

    const skipAmount = (Number(page) - 1) * limit;
    const conditions = { buyer: userId }; // Clerk user ID (string)

    const orders = await Order.find(conditions)
      .sort({ createdAt: "desc" })
      .skip(skipAmount)
      .limit(limit)
      .populate({
        path: "event",
        model: Event,
        select: "_id title organizer", // Adjust fields as needed
      });

    const ordersCount = await Order.countDocuments(conditions);

    return {
      data: JSON.parse(JSON.stringify(orders)),
      totalPages: Math.ceil(ordersCount / limit),
    };
  } catch (error) {
    handleError(error);
  }
}

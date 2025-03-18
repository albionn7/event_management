const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
import { NextResponse } from "next/server";
import { createOrder } from "@/lib/actions/order.actions";

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature") as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error("⚠️  Webhook signature verification failed.", err.message);
    return new Response(`Webhook error: ${err.message}`, { status: 400 });
  }

  // Get the ID and type
  const eventType = event.type;

  // CREATE ORDER
  if (eventType === "checkout.session.completed") {
    const { id, amount_total } = event.data.object;
    const metadata = event.data.object.metadata || {}; // Ensure metadata is always an object

    const order = {
      stripeId: id,
      eventId: metadata.eventId || "",
      buyerId: metadata.buyerId || "",
      totalAmount: amount_total ? (amount_total / 100).toString() : "0",
      createdAt: new Date(),
    };

    const newOrder = await createOrder(order);
    return NextResponse.json({ message: "OK", order: newOrder });
  }

  return new Response("", { status: 200 });
}

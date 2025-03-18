import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createOrder } from "@/lib/actions/order.actions";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(request: Request) {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  let event;

  try {
    const body = await request.text(); // Ensure raw body is read
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed.", err.message);
    return NextResponse.json(
      { message: "Webhook error", error: err.message },
      { status: 400 }
    );
  }

  // Process checkout.session.completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const order = {
      stripeId: session.id,
      eventId: session.metadata?.eventId || "",
      buyerId: session.metadata?.buyerId || "",
      totalAmount: session.amount_total
        ? (session.amount_total / 100).toString()
        : "0",
      createdAt: new Date(),
    };

    try {
      const newOrder = await createOrder(order);
      console.log("✅ Order created:", newOrder);
      return NextResponse.json({ message: "OK", order: newOrder });
    } catch (err) {
      if (err instanceof Error) {
        console.error(err.message);
      } else {
        console.error("An unknown error occurred", err);
      }
    }
  }

  return new Response("", { status: 200 });
}

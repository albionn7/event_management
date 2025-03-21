"use client";

import { IEvent } from "@/lib/database/models/event.model";
import { SignedIn, SignedOut, useUser } from "@clerk/nextjs"; // Use useUser hook
import Link from "next/link";
import React from "react";
import { Button } from "../ui/button";
import Checkout from "./Checkout";

const CheckoutButton = ({ event }: { event: IEvent }) => {
  const { user } = useUser(); // Get user data from Clerk
  const userId = user?.id; // User ID from Clerk's user object
  const hasEventFinished = new Date(event.endDateTime) < new Date();

  if (!userId) {
    return (
      <div className="flex items-center gap-3">
        <SignedOut>
          <Button asChild className="button rounded-full" size="lg">
            <Link href="/sign-in">Get Tickets</Link>
          </Button>
        </SignedOut>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {hasEventFinished ? (
        <p className="p-2 text-red-400">
          Sorry, tickets are no longer available.
        </p>
      ) : (
        <>
          <SignedOut>
            <Button asChild className="button rounded-full" size="lg">
              <Link href="/sign-in">Get Tickets</Link>
            </Button>
          </SignedOut>

          <SignedIn>
            {/* Pass userId to Checkout component */}
            <Checkout event={event} userId={userId} />
          </SignedIn>
        </>
      )}
    </div>
  );
};

export default CheckoutButton;

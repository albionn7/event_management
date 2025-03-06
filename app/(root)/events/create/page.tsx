import EventForm from "@/components/shared/EventForm";
import { auth } from "@clerk/nextjs/server";

const CreateEvent = async () => {
  // const { userId } = await auth();
  const { sessionClaims } = await auth();
  // console.log(sessionClaims);
  const userId = sessionClaims?.userId as string;

  // const userIdString = userId ?? "";
  console.log("User ID:", userId);

  return (
    <>
      <section className="bg-primary-50 bg-dotted-pattern bg-cover bg-center py-5 md:py-10">
        <h3 className="wrapper h3-bold text-center sm:text-left">
          Create Events
        </h3>
      </section>
      <div className="wrapper my-8">
        <EventForm userId={userId} type="Create" />
      </div>
    </>
  );
};

export default CreateEvent;

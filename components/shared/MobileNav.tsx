import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Image from "next/image";
import { Separator } from "../ui/separator";
import NavItems from "./NavItems";

const MobileNav = () => {
  return (
    <nav className="md:hidden">
      <Sheet>
        <SheetTrigger className="align-middle ">
          <Image
            src="/assets/icons/menu.svg"
            alt="meny"
            width={24}
            height={24}
            className=" cursor-pointer"
          ></Image>
        </SheetTrigger>
        <SheetContent className="flex flex-col gap-6 bg-white md:hidden">
          <Image
            src="assets/icons/logo.svg"
            alt="logo"
            width={128}
            height={38}
          ></Image>
          <Separator className="border border-gray-50">
            <NavItems></NavItems>
          </Separator>
        </SheetContent>
      </Sheet>
    </nav>
  );
};

export default MobileNav;

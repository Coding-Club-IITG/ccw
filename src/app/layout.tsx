import type { Metadata } from "next";
import "@/styles/globals.scss";
import Navbar from "@/components/layout/Navbar/Navbar";

export const metadata: Metadata = {
  title: "Coding Club IITG",
  description: "Official website of Coding Club IITG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}

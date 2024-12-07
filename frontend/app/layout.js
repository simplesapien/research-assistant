// app/layout.js
import localFont from "next/font/local"
import { AuthProvider } from "@/lib/auth"
import "./globals.css"

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
})
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
})

export const metadata = {
  title: "Research Tools",
  description: "Search for research tools",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <div className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}>
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
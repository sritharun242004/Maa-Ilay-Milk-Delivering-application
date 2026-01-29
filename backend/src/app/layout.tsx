import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Maa Ilay API",
    description: "Backend API for Maa Ilay milk delivery service",
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    )
}

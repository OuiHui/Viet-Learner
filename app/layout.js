import './globals.css';

export const metadata = {
  title: 'Viet Learner - Learn Vietnamese in Context',
  description: 'Learn Vietnamese from context, not in isolation',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}

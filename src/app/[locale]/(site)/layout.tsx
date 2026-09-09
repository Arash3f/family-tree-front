import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";

type Props = {
  children: React.ReactNode;
};

export default function SiteLayout({ children }: Props) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}

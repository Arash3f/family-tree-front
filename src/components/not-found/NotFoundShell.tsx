import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { NotFoundView } from "@/components/not-found/NotFoundView";
import styles from "./NotFoundShell.module.css";

export function NotFoundShell() {
  return (
    <>
      <Header />
      <main id="main" className={styles.main}>
        <NotFoundView />
      </main>
      <Footer />
    </>
  );
}

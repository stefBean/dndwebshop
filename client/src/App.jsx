import { BrowserRouter, Route, Routes } from "react-router-dom";
import ShopProvider from "./state/ShopProvider.jsx";
import { EmptyState, Icon, LinkButton } from "./components/ui.jsx";
import PageLayout from "./components/layout/PageLayout.jsx";
import ShopPage from "./pages/ShopPage.jsx";
import ProductPage from "./pages/ProductPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
function NotFoundPage() {
  return (
    <main className="shell py-16 sm:py-24">
      <EmptyState
        title="An unexplored path"
        icon="dice"
        action={
          <LinkButton to="/products">
            Back to the collection <Icon name="arrowRight" size={17} />
          </LinkButton>
        }
      >
        This page has slipped beyond the map. Your next adventure is waiting in
        the shop.
      </EmptyState>
    </main>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <ShopProvider>
        <Routes>
          <Route element={<PageLayout />}>
            <Route index element={<ShopPage featured />} />
            <Route path="products" element={<ShopPage />} />
            <Route path="products/:id" element={<ProductPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="login" element={<AuthPage mode="login" />} />
            <Route path="register" element={<AuthPage mode="register" />} />
            <Route path="account/orders" element={<OrdersPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </ShopProvider>
    </BrowserRouter>
  );
}

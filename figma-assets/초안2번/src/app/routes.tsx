import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Editor } from "./pages/Editor";
import { Preview } from "./pages/Preview";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "editor/:id", Component: Editor },
      { path: "preview/:id", Component: Preview },
    ],
  },
]);

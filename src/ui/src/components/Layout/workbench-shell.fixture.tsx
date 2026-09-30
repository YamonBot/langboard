import { createContext, useContext } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, Link, RouterProvider, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WorkbenchRouteLayout from "./WorkbenchRouteLayout";
import DashboardStyledLayout from "./DashboardStyledLayout";
import "@/i18n";
import "@/assets/styles/main.css";

const PageContext = createContext("missing context");
function SidebarContent() {
    return <p>{useContext(PageContext)}</p>;
}
function Page({ name }: { name: string }) {
    const location = useLocation();
    return (
        <PageContext.Provider value={`Sidebar ${name}`}>
            <DashboardStyledLayout
                headerNavs={[]}
                headerTitle={name}
                activityRailItems={[{ icon: "panel-left", label: "Explorer", active: true, onClick: () => {} }]}
                workbenchContext={<SidebarContent />}
            >
                <h1>{name}</h1>
                <p>{location.pathname}</p>
                <Link to="/dashboard/projects/all">Open Dashboard</Link>
                <Link to="/board/fixture">Open Board</Link>
                <Link to="/board/fixture/card">Open Card</Link>
                <Link to="/board/fixture/wiki">Open Wiki</Link>
            </DashboardStyledLayout>
        </PageContext.Provider>
    );
}
const router = createMemoryRouter(
    [
        {
            element: <WorkbenchRouteLayout />,
            children: [
                { path: "/dashboard/projects/all", element: <Page name="Dashboard" /> },
                { path: "/board/fixture", element: <Page name="Board" /> },
                { path: "/board/fixture/card", element: <Page name="Card" /> },
                { path: "/board/fixture/wiki", element: <Page name="Wiki" /> },
            ],
        },
    ],
    { initialEntries: ["/dashboard/projects/all"] }
);
createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
    </QueryClientProvider>
);

import * as React from 'react';
import { Button } from './ui/button.js';
import 'class-variance-authority/types';
import 'class-variance-authority';

type NavigationActionHandler = React.MouseEventHandler<HTMLButtonElement>;
type NavigationButtonProps = React.ComponentProps<typeof Button> & {
    /** Visible button text. Falls back to children when omitted. */
    label?: React.ReactNode;
    /** Semantic action callback; `onClick` remains supported for compatibility. */
    onAction?: NavigationActionHandler;
};
type NavButtonProps = NavigationButtonProps;
type BlankButtonProps = NavigationButtonProps;
type BackButtonProps = NavigationButtonProps;
type BookmarkButtonProps = NavigationButtonProps;
type DrillThroughButtonProps = NavigationButtonProps;
type PageNavigationButtonProps = NavigationButtonProps;
type QAButtonProps = NavigationButtonProps;
type ApplyAllSlicersButtonProps = NavigationButtonProps;
type ClearAllSlicersButtonProps = NavigationButtonProps;
declare function NavButton({ label, children, className, ...props }: NavButtonProps): React.JSX.Element;
declare function BlankButton({ label, children, className, ...props }: BlankButtonProps): React.JSX.Element;
declare function BackButton({ label, children, className, ...props }: BackButtonProps): React.JSX.Element;
declare function BookmarkButton({ label, children, className, ...props }: BookmarkButtonProps): React.JSX.Element;
declare function DrillThroughButton({ label, children, className, ...props }: DrillThroughButtonProps): React.JSX.Element;
declare function PageNavigationButton({ label, children, className, ...props }: PageNavigationButtonProps): React.JSX.Element;
type WebUrlButtonProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "children"> & {
    label?: React.ReactNode;
    children?: React.ReactNode;
    href?: string;
    onNavigate?: React.MouseEventHandler<HTMLAnchorElement>;
};
declare function WebUrlButton({ label, href, className, children, onNavigate, onClick, target, rel, ...props }: WebUrlButtonProps): React.JSX.Element;
declare function QAButton({ label, children, className, ...props }: QAButtonProps): React.JSX.Element;
declare function ApplyAllSlicersButton({ label, children, className, ...props }: ApplyAllSlicersButtonProps): React.JSX.Element;
declare function ClearAllSlicersButton({ label, children, className, ...props }: ClearAllSlicersButtonProps): React.JSX.Element;
interface PageNavigatorItem {
    id: string;
    label: React.ReactNode;
    disabled?: boolean;
}
interface PageNavigatorProps {
    pages?: readonly PageNavigatorItem[];
    /** Controlled active page ID. Pass null to render no active page. */
    activeId?: string | null;
    /** Initial page ID for uncontrolled use. */
    defaultActiveId?: string;
    onActiveChange?: (activeId: string, page: PageNavigatorItem) => void;
    className?: string;
    ariaLabel?: string;
    /** @deprecated Use activeId. */
    activePage?: string;
}
declare function PageNavigator({ pages, activeId, defaultActiveId, onActiveChange, activePage, className, ariaLabel, }: PageNavigatorProps): React.JSX.Element;
interface BookmarkNavigatorItem {
    id: string;
    name: string;
    page: string;
    disabled?: boolean;
}
interface BookmarkNavigatorProps {
    /** Supplying bookmarks controls the collection; omit for a self-managing demo. */
    bookmarks?: readonly BookmarkNavigatorItem[];
    activeId?: string | null;
    defaultActiveId?: string;
    onActiveChange?: (activeId: string | null, bookmark?: BookmarkNavigatorItem) => void;
    onSelect?: (bookmark: BookmarkNavigatorItem) => void;
    onAdd?: (bookmark: BookmarkNavigatorItem) => void;
    onDelete?: (bookmark: BookmarkNavigatorItem) => void;
    createBookmark?: () => BookmarkNavigatorItem;
    className?: string;
    title?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
}
declare function BookmarkNavigator({ bookmarks, activeId, defaultActiveId, onActiveChange, onSelect, onAdd, onDelete, createBookmark, className, title, searchPlaceholder, emptyMessage, }: BookmarkNavigatorProps): React.JSX.Element;

export { ApplyAllSlicersButton, type ApplyAllSlicersButtonProps, BackButton, type BackButtonProps, BlankButton, type BlankButtonProps, BookmarkButton, type BookmarkButtonProps, BookmarkNavigator, type BookmarkNavigatorItem, type BookmarkNavigatorProps, ClearAllSlicersButton, type ClearAllSlicersButtonProps, DrillThroughButton, type DrillThroughButtonProps, NavButton, type NavButtonProps, type NavigationActionHandler, type NavigationButtonProps, PageNavigationButton, type PageNavigationButtonProps, PageNavigator, type PageNavigatorItem, type PageNavigatorProps, QAButton, type QAButtonProps, WebUrlButton, type WebUrlButtonProps };

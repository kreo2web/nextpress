import * as React from "react";
import type { JSX } from "react";
import type { BlockConfig } from "@shared/schema-types";
import { getRenderProps, parseStructuredContent, renderChildBlocks, getBlockComponent } from "../render-helpers";
import {
	buildColumnStyle,
	buildColumnsContainerStyle,
	readColumnLayoutFromBlock,
	readColumnsDataFromBlock,
} from "@shared/columns-layout";
import {
	getBlockSiblingFlexItemStyles,
	getBlockStackLayerWrapperStyles,
	getOverlayChildItemStyles,
	isOverlayFillBehind,
	getContainerChildrenStackStyle,
	getContainerOuterShellStyle,
	getContainerSiblingStackDirection,
	readContainerLayoutFromBlock,
} from "@shared/block-container-placement";
import { buildGroupShellStyles, readGroupShellContent } from "@shared/group-shell-styles";
import { buildStackShellStyles } from "@shared/stack-shell-styles";
import { getHorizontalFlexChildStyles } from "@shared/container-child-flex";
import { headerFloatWrapperStyles, headerOverlayPaintStyles } from "@shared/header-model";
import { PageShellBlock } from "./page-shell";
import { HeaderBlock } from "./header";

export { PageShellBlock } from "./page-shell";
export { HeaderBlock } from "./header";

/**
 * Columns Block Component
 * Renders a flexible column layout with nested children
 */
export function ColumnsBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const data = readColumnsDataFromBlock(block);
	const layoutMode = data.layoutMode || "flex";
	const direction = data.direction || "row";
	const columnVerticalAlignment = data.columnVerticalAlignment || "top";
	const columnHorizontalAlignment = data.columnHorizontalAlignment || "stretch";
	const columnLayout = readColumnLayoutFromBlock(block);

	const mergedClassName = [
		"wp-block-columns",
		data.verticalAlignment ? `is-vertically-aligned-${data.verticalAlignment}` : "",
		data.horizontalAlignment ? `is-horizontally-aligned-${data.horizontalAlignment}` : "",
		className,
	]
		.filter(Boolean)
		.join(" ");

	const columnsStyle = buildColumnsContainerStyle(data, columnLayout, style);

	const columnAlignItems = {
		stretch: "stretch",
		left: "flex-start",
		center: "center",
		right: "flex-end",
	}[columnHorizontalAlignment];

	const columnJustifyContent = {
		top: "flex-start",
		center: "center",
		bottom: "flex-end",
		stretch: "stretch",
	}[columnVerticalAlignment];

	const renderChild = (child: BlockConfig): React.ReactNode => {
		const ChildComponent = getBlockComponent(child.name);
		if (!ChildComponent) {
			return null;
		}
		return <ChildComponent key={child.id} {...child} />;
	};

	return (
		<div
			className={mergedClassName || undefined}
			style={columnsStyle}
			{...attributes}
		>
			{columnLayout.map((column, index) => {
				const columnChildren =
					block.children?.filter((child) => column.blockIds?.includes(child.id)) || [];
				const columnKey = column.columnId || `column-${index}`;
				const columnStyle = buildColumnStyle(data, layoutMode, direction, column, columnLayout);

				return (
					<div
						key={columnKey}
						className="wp-block-column"
						style={{
							...columnStyle,
							display: "flex",
							flexDirection: "column",
							alignItems: columnAlignItems,
							justifyContent: columnJustifyContent,
							minWidth: 0,
							// Match the client preview's `space-y-2` inter-child gap (8px)
							// so column spacing is identical in preview and publish.
							gap: "8px",
						}}
					>
						{columnChildren.map((child) => (
							<div
								key={child.id}
								style={{
									width: "100%",
									minWidth: 0,
									...getBlockSiblingFlexItemStyles(child.styles, "column"),
									...getBlockStackLayerWrapperStyles(child),
								}}
							>
								{renderChild(child)}
							</div>
						))}
					</div>
				);
			})}
		</div>
	);
}

/**
 * Group Block Component
 * Renders a container group with nested children
 */
export function GroupBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const data = parseStructuredContent(block.content);
	const layout = data.layout as string | undefined;
	const tagName = (data.tagName as string) || "div";

	const Tag = tagName as "div" | "section" | "article" | "main" | "header" | "footer" | "aside" | "nav" | "span" | "p";

	const mergedClassName = [
		"wp-block-group",
		layout ? `is-layout-${layout}` : "",
		className,
	]
		.filter(Boolean)
		.join(" ");

	const shellContent = readGroupShellContent(block.content);
	const { outerStyle, innerStackStyle, stackDirection, isHorizontal } = buildGroupShellStyles({
		styles: style,
		content: shellContent,
		children: block.children?.map((child) => ({ styles: child.styles })),
	});

	const renderChild = (child: BlockConfig): React.ReactNode => {
		const ChildComponent = getBlockComponent(child.name);
		if (!ChildComponent) {
			return null;
		}
		const rowFlex = getHorizontalFlexChildStyles({
			isHorizontal,
			childStyles: child.styles,
			blockName: child.name,
			shrink: child.settings?.stackShrink === true,
		});
		return (
			<div
				key={child.id}
				style={{
					...rowFlex,
					...getBlockSiblingFlexItemStyles(child.styles, stackDirection),
					...getBlockStackLayerWrapperStyles(child),
					...headerFloatWrapperStyles(child),
				}}
			>
				<ChildComponent {...child} />
			</div>
		);
	};

	if (block.children && block.children.length > 0) {
		return (
			<Tag
				className={mergedClassName || undefined}
				style={outerStyle}
				{...attributes}
			>
				<div className="wp-block-group__inner-container" style={innerStackStyle}>
					{block.children.map((child) => renderChild(child))}
				</div>
			</Tag>
		);
	}

	return (
		<Tag className={mergedClassName || undefined} style={outerStyle} {...attributes}>
			<div className="wp-block-group__inner-container" style={innerStackStyle} />
		</Tag>
	);
}

/**
 * Stack Block Component — vertical / horizontal / AB overlay container.
 * Overlay (AB): every child shares grid cell 1/1; child order paints bottom-to-top
 * and `other.stackLayer` overrides. Consumes the same shared helpers as the editor
 * canvas so preview and publish cannot drift.
 */
export function StackBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);

	const mergedClassName = ["wp-block-stack", className].filter(Boolean).join(" ");
	const childBlocks = block.children ?? [];
	const { outerStyle, innerStackStyle, isHorizontal, isOverlay, overlayHugsBase } = buildStackShellStyles({
		styles: style,
		content: block.content,
		children: childBlocks.map((child) => ({ name: child.name, styles: child.styles, content: child.content })),
	});

	const renderChild = (child: BlockConfig): React.ReactNode => {
		const ChildComponent = getBlockComponent(child.name);
		if (!ChildComponent) {
			return null;
		}
		const wrapper = isOverlay
			? {
					...getOverlayChildItemStyles(child.styles, {
						heldToBase: overlayHugsBase && child !== childBlocks[0],
						fillsBehind: isOverlayFillBehind(child),
					}),
					...getBlockStackLayerWrapperStyles(child),
					...headerOverlayPaintStyles(child),
				}
			: {
					...getHorizontalFlexChildStyles({
						isHorizontal,
						childStyles: child.styles,
						blockName: child.name,
						shrink: child.settings?.stackShrink === true,
					}),
					...getBlockSiblingFlexItemStyles(child.styles, isHorizontal ? "row" : "column"),
					...getBlockStackLayerWrapperStyles(child),
				};
		return (
			<div key={child.id} style={{ ...wrapper, ...headerFloatWrapperStyles(child) }}>
				<ChildComponent {...child} />
			</div>
		);
	};

	return (
		<div className={mergedClassName || undefined} style={outerStyle} {...attributes}>
			<div className="wp-block-stack__inner" style={innerStackStyle}>
				{childBlocks.map((child) => renderChild(child))}
			</div>
		</div>
	);
}

/**
 * Container Block — single column wrapper with styles from block config
 */
export function ContainerBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const data = parseStructuredContent(block.content);
	const tagName = (data.tagName as string) || "div";
	const dataClassName = data.className as string | undefined;

	const Tag = tagName as "div" | "section" | "article" | "aside";

	const mergedClassName = ["wp-block-container", dataClassName, className].filter(Boolean).join(" ");
	const layout = readContainerLayoutFromBlock({ styles: style });
	const stackDirection = getContainerSiblingStackDirection(layout);
	const isHorizontal = stackDirection === "row";
	const innerStackStyle = getContainerChildrenStackStyle(layout, {
		shellStyles: style,
		children: block.children?.map((child) => ({ styles: child.styles })),
	});
	const outerStyle = getContainerOuterShellStyle(style, {
		children: block.children?.map((child) => ({ styles: child.styles })),
	});

	const renderChild = (child: BlockConfig, index: number): React.ReactNode => {
		const ChildComponent = getBlockComponent(child.name);
		if (!ChildComponent) {
			return null;
		}
		const rowFlex = getHorizontalFlexChildStyles({
			isHorizontal,
			childStyles: child.styles,
			blockName: child.name,
			shrink: child.settings?.stackShrink === true,
		});
		return (
			<div
				key={child.id}
				style={{
					...rowFlex,
					...getBlockSiblingFlexItemStyles(child.styles, stackDirection),
					...getBlockStackLayerWrapperStyles(child),
				}}
			>
				<ChildComponent {...child} />
			</div>
		);
	};

	if (block.children && block.children.length > 0) {
		return (
			<Tag
				className={mergedClassName || undefined}
				style={outerStyle}
				{...attributes}
			>
				<div className="wp-block-container__inner" style={innerStackStyle}>
					{block.children.map((child, index) => renderChild(child, index))}
				</div>
			</Tag>
		);
	}

	return (
		<Tag
			className={mergedClassName || undefined}
			style={outerStyle}
			{...attributes}
		>
			<div className="wp-block-container__inner" style={innerStackStyle} />
		</Tag>
	);
}

const DEFAULT_SPACER_HEIGHT = "100px";

/**
 * Legacy spacers store a pixel number (100). New writes are CSS lengths ("100px").
 * Missing or empty is unset so the caller can fall back to 100px.
 */
function readSpacerHeight(value: string | number | null | undefined): string | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return `${value}px`;
	}
	if (typeof value === "string" && value.trim() !== "") {
		return value;
	}
	return undefined;
}

function readStyleHeight(height: React.CSSProperties["height"]): string | undefined {
	if (typeof height === "number" && Number.isFinite(height)) {
		return `${height}px`;
	}
	if (typeof height === "string" && height.trim() !== "") {
		return height;
	}
	return undefined;
}

/**
 * Content height first, then a copy of style. Style height wins only when it is
 * actually set — an absent style height must not wipe the spacer value.
 */
function buildSpacerStyle(
	contentHeight: string | undefined,
	style: React.CSSProperties,
): React.CSSProperties {
	const fromContent = contentHeight ?? DEFAULT_SPACER_HEIGHT;
	const spacerStyle: React.CSSProperties = {
		height: fromContent,
		...style,
	};
	const fromStyle = readStyleHeight(style.height);
	if (fromStyle !== undefined) {
		spacerStyle.height = fromStyle;
	} else {
		spacerStyle.height = fromContent;
	}
	return spacerStyle;
}

/**
 * Spacer Block Component
 * Renders a vertical spacer with configurable height
 */
export function SpacerBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const data = parseStructuredContent(block.content);
	const rawHeight = data.height;
	const contentHeight =
		typeof rawHeight === "number" || typeof rawHeight === "string"
			? readSpacerHeight(rawHeight)
			: undefined;

	const mergedClassName = ["wp-block-spacer", className]
		.filter(Boolean)
		.join(" ");

	return (
		<div
			className={mergedClassName || undefined}
			style={buildSpacerStyle(contentHeight, style)}
			{...attributes}
		/>
	);
}

/**
 * Separator Block Component
 * Renders a horizontal separator line
 */
export function SeparatorBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const data = parseStructuredContent(block.content);
	const separatorStyle = data.separatorStyle as string | undefined;

	const mergedClassName = [
		"wp-block-separator",
		separatorStyle ? `is-style-${separatorStyle}` : "",
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<hr
			className={mergedClassName || undefined}
			style={style}
			{...(attributes as Record<string, unknown>)}
		/>
	);
}

/**
 * Divider Block Component
 * Renders a divider line with optional styling
 */
export function DividerBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const data = parseStructuredContent(block.content);
	const storedStyle = data.style;
	const legacyStyle = data.dividerStyle;
	const lineStyle =
		storedStyle === "solid" || storedStyle === "dashed" || storedStyle === "dotted"
			? storedStyle
			: legacyStyle === "solid" || legacyStyle === "dashed" || legacyStyle === "dotted"
				? legacyStyle
				: "solid";
	const storedColor = data.color;
	const lineColor =
		typeof storedColor === "string" && storedColor.trim() !== ""
			? storedColor
			: "currentColor";
	const storedWidth = data.width;
	const lineWidth =
		typeof storedWidth === "number" && Number.isFinite(storedWidth) ? storedWidth : 100;

	const mergedClassName = ["wp-block-divider", `is-style-${lineStyle}`, className]
		.filter(Boolean)
		.join(" ");
	const { padding, margin, ...restStyle } = style;

	return (
		<div
			className={mergedClassName || undefined}
			style={{ padding, margin }}
			{...(attributes as Record<string, unknown>)}
		>
			<hr
				style={{
					...restStyle,
					borderStyle: lineStyle,
					borderWidth: "1px 0 0 0",
					borderColor: lineColor,
					width: `${lineWidth}%`,
					margin: "0 auto",
				}}
			/>
		</div>
	);
}

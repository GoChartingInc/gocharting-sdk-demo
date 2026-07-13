import React, { useEffect, useRef, useState } from "react";

// ponytail: Safari draws native <option> popups that CSS can't style, so this
// minimal custom dropdown exists purely to theme the open menu. Two options,
// no search/virtualization — upgrade to a lib if option lists ever grow.

const boxStyle: React.CSSProperties = {
	width: "100%",
	padding: "10px 30px 10px 10px",
	border: "1px solid rgba(255, 255, 255, 0.3)",
	borderRadius: "6px",
	background: "rgba(255, 255, 255, 0.1)",
	color: "white",
	fontSize: "14px",
	textAlign: "left",
	cursor: "pointer",
	position: "relative",
};

const chevronStyle: React.CSSProperties = {
	position: "absolute",
	right: "10px",
	top: "50%",
	transform: "translateY(-50%)",
	pointerEvents: "none",
	fontSize: "10px",
	color: "#b0b0b0",
};

const menuStyle: React.CSSProperties = {
	position: "absolute",
	top: "calc(100% + 4px)",
	left: 0,
	right: 0,
	margin: 0,
	padding: "4px",
	listStyle: "none",
	background: "#23273a",
	border: "1px solid rgba(255, 255, 255, 0.3)",
	borderRadius: "6px",
	boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
	zIndex: 1000,
};

interface ThemedSelectOption {
	value: string;
	label: string;
}

interface ThemedSelectProps {
	id?: string;
	value: string;
	options: ThemedSelectOption[];
	onChange: (value: string) => void;
}

export function ThemedSelect({ id, value, options, onChange }: ThemedSelectProps) {
	const [open, setOpen] = useState(false);
	const [hovered, setHovered] = useState<string | null>(null);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const close = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", close);
		return () => document.removeEventListener("mousedown", close);
	}, [open]);

	const selected = options.find((o) => o.value === value);

	return (
		<div ref={ref} style={{ position: "relative" }}>
			<button
				type='button'
				id={id}
				aria-haspopup='listbox'
				aria-expanded={open}
				onClick={() => setOpen((o) => !o)}
				onKeyDown={(e) => {
					if (e.key === "Escape") setOpen(false);
				}}
				style={boxStyle}
			>
				{selected?.label ?? value}
				<span style={chevronStyle}>▼</span>
			</button>
			{open && (
				<ul role='listbox' style={menuStyle}>
					{options.map((o) => (
						<li
							key={o.value}
							role='option'
							aria-selected={o.value === value}
							onClick={() => {
								onChange(o.value);
								setOpen(false);
							}}
							onMouseEnter={() => setHovered(o.value)}
							onMouseLeave={() => setHovered(null)}
							style={{
								padding: "8px 10px",
								borderRadius: "4px",
								fontSize: "14px",
								color: "white",
								cursor: "pointer",
								background:
									hovered === o.value
										? "#4a90e2"
										: o.value === value
										? "rgba(255, 255, 255, 0.1)"
										: "transparent",
							}}
						>
							{o.label}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

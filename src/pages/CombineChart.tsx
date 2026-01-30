import ChartSDK from "@/components/ChartSDK";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";

import { useResponsive } from "@/hooks/useResponsive";

const CombineChart = () => {
	const { isSmallDevice, isMediumDevice } = useResponsive();
	const isMobile = isSmallDevice || isMediumDevice;

	return (
		<ResponsiveLayout
			mainProps={{
				gap: isMobile ? "32px" : "42px",
			}}
		>
			{/* Header */}
			{/* <Box
				width='100%'
				flexDirection='column'
				gap={isMobile ? "20px" : "16px"}
			>
				<Box
					width='100%'
					alignItems='center'
					justifyContent='space-between'
				>
					{isMobile ? (
						<Box gap='12px' alignItems='center'>
							<Box
								cursor='pointer'
								onClickCapture={handleMenuClick}
								p='8px'
								borderRadius='8px'
								style={{
									transition: "background-color 0.2s",
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.backgroundColor =
										"rgba(255, 255, 255, 0.1)";
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.backgroundColor =
										"transparent";
								}}
							>
								<MenuIcon />
							</Box>
							<Text
								fontFamily='Lora, serif'
								fontSize='24px'
								lineHeight='32px'
							>
								Dashboard
							</Text>
						</Box>
					) : (
						<Box gap='4px' flexDirection='column'>
							<Text
								fontSize='14px'
								fontWeight='500'
								lineHeight='20px'
								opacity='0.5'
							>
								{moment().format("MMM DD, YYYY")}, Today
							</Text>
							<Text
								fontFamily='Lora, serif'
								fontSize='24px'
								lineHeight='32px'
							>
								Good Morning, Zulu
							</Text>
						</Box>
					)}
				</Box>
			</Box> */}
			<ChartSDK />
		</ResponsiveLayout>
	);
};

export default CombineChart;

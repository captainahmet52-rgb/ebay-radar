import { Composition } from "remotion";
import { Demo, DEMO_DURATION, DEMO_FPS } from "./Demo";
import { EbayLogo, EBAY_LOGO_DURATION, EBAY_LOGO_FPS } from "./EbayLogo";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Demo"
      component={Demo}
      durationInFrames={DEMO_DURATION}
      fps={DEMO_FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="EbayLogo"
      component={EbayLogo}
      durationInFrames={EBAY_LOGO_DURATION}
      fps={EBAY_LOGO_FPS}
      width={480}
      height={480}
    />
  </>
);

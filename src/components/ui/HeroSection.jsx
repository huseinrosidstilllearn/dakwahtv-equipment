import * as React from "react"
import { cn } from "../../lib/utils"
import { ChevronRight } from "lucide-react"

const RetroGrid = ({
  angle = 65,
  cellSize = 60,
  opacity = 0.5,
  lightLineColor = "gray",
  darkLineColor = "gray",
}) => {
  const gridStyles = {
    "--grid-angle": `${angle}deg`,
    "--cell-size": `${cellSize}px`,
    "--opacity": opacity,
    "--light-line": lightLineColor,
    "--dark-line": darkLineColor,
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute size-full overflow-hidden [perspective:200px]",
        `opacity-[var(--opacity)]`,
      )}
      style={gridStyles}
    >
      <div className="absolute inset-0 [transform:rotateX(var(--grid-angle))]">
        <div className="animate-grid [background-image:linear-gradient(to_right,var(--light-line)_1px,transparent_0),linear-gradient(to_bottom,var(--light-line)_1px,transparent_0)] [background-repeat:repeat] [background-size:var(--cell-size)_var(--cell-size)] [height:300vh] [inset:0%_0px] [margin-left:-200%] [transform-origin:100%_0_0] [width:600vw] dark:[background-image:linear-gradient(to_right,var(--dark-line)_1px,transparent_0),linear-gradient(to_bottom,var(--dark-line)_1px,transparent_0)]" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent to-90% dark:from-background" />
    </div>
  )
}

const HeroSection = React.forwardRef(
  (
    {
      className,
      title = "Build products for everyone",
      subtitle = {
        regular: "Designing your projects faster with ",
        gradient: "the largest figma UI kit.",
      },
      description = "Sed ut perspiciatis unde omnis iste natus voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae.",
      ctaText = "Browse courses",
      ctaHref = "#",
      bottomImage,
      gridOptions,
      ...props
    },
    ref,
  ) => {
    return (
      <div className={cn("relative min-h-[100dvh] flex flex-col items-center justify-center", className)} ref={ref} {...props}>
        <div className="absolute top-0 z-[0] h-full w-full bg-primary/10 dark:bg-primary/5 bg-[radial-gradient(ellipse_20%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_20%_80%_at_50%_-20%,rgba(216,121,67,0.2),rgba(255,255,255,0))]" />
        <section className="relative max-w-full mx-auto z-10 py-12 md:py-16 overflow-hidden w-full">
          <RetroGrid {...gridOptions} />
          <div className="max-w-screen-xl z-10 mx-auto px-4 py-10 md:py-20 gap-12 md:px-8 flex flex-col items-center">
            <div className="space-y-6 max-w-4xl leading-0 lg:leading-5 mx-auto text-center">
              <div className="relative mx-auto mb-6 md:mb-10 w-fit flex justify-center group">
                <style>
                  {`
                    @keyframes float {
                      0%, 100% { transform: translateY(0); }
                      50% { transform: translateY(-10px); }
                    }
                    .animate-float {
                      animation: float 4s ease-in-out infinite;
                    }
                  `}
                </style>
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full group-hover:bg-primary/40 group-hover:scale-110 transition-all duration-700 animate-pulse" />
                <div className="relative p-2 animate-float">
                  <img 
                    src="/logo-hero.png" 
                    alt="Dakwah TV Logo" 
                    className="relative z-10 h-28 sm:h-36 md:h-48 object-contain drop-shadow-[0_0_20px_rgba(38,166,149,0.4)] hover:drop-shadow-[0_0_35px_rgba(38,166,149,0.8)] hover:scale-105 transition-all duration-500"
                  />
                </div>
              </div>
              <style>
                {`
                  @keyframes colorCycle {
                    0%, 100% { color: #26A69A; text-shadow: 0 0 10px rgba(38,166,149,0.5); }
                    50% { color: #80CBC4; text-shadow: 0 0 15px rgba(128,203,196,0.8); }
                  }
                  .animate-color-cycle {
                    animation: colorCycle 3s ease-in-out infinite;
                  }
                `}
              </style>
              <h1 className="text-sm md:text-lg font-bold animate-color-cycle group mx-auto px-6 py-2 bg-gradient-to-tr from-foreground/5 via-foreground/10 to-transparent border-[2px] border-border rounded-3xl w-fit">
                {title}
              </h1>
              <h2 className="text-5xl md:text-6xl lg:text-7xl tracking-tighter font-display font-extrabold bg-clip-text text-transparent mx-auto bg-[linear-gradient(180deg,_#000_0%,_rgba(0,_0,_0,_0.75)_100%)] dark:bg-[linear-gradient(180deg,_#FFF_0%,_rgba(255,_255,_255,_0.00)_202.08%)] mt-6">
                {subtitle.regular}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-teal-light">
                  {subtitle.gradient}
                </span>
              </h2>
              <p className="max-w-2xl mx-auto text-foreground/70 mt-4 text-base md:text-lg">
                {description}
              </p>
              <div className="items-center justify-center gap-x-3 space-y-3 sm:flex sm:space-y-0 mt-8 mb-12">
                <span className="relative inline-block overflow-hidden rounded-full p-[2px]">
                  <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,#26a695_50%,transparent_100%)]" />
                  <div className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-background backdrop-blur-3xl">
                    <a
                      href={ctaHref}
                      className="relative overflow-hidden inline-flex rounded-full text-center group items-center w-full justify-center bg-gradient-to-tr from-primary/10 via-primary/20 to-transparent border-input border-[1px] transition-all sm:w-auto py-5 px-12 text-base md:text-lg font-bold animate-color-cycle tracking-wide hover:ring-2 hover:ring-primary/50 hover:ring-offset-2 hover:ring-offset-background hover:scale-[1.02]"
                    >
                      <span className="relative z-10">{ctaText}</span>
                      <div className="absolute inset-0 -z-10 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <div className="absolute inset-0 -z-10 w-full translate-x-[-100%] animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    </a>
                  </div>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Scroll Indicator */}
        <div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center cursor-pointer opacity-70 hover:opacity-100 transition-opacity" 
          onClick={() => {
            const el = document.getElementById('menu-cards');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth' });
            } else {
              window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
            }
          }}
        >
          <span className="text-[10px] font-bold tracking-[0.3em] text-primary mb-2 uppercase animate-pulse">Eksplor</span>
          <div className="w-6 h-10 rounded-full border-2 border-primary/30 flex justify-center p-1">
            <div className="w-1.5 h-2.5 bg-primary rounded-full animate-bounce" />
          </div>
        </div>
      </div>
    )
  },
)
HeroSection.displayName = "HeroSection"

export { HeroSection }

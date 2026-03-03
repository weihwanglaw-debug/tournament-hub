import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, MapPin, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import config from "@/data/config.json";
import type { TournamentEvent } from "@/types/config";
import { getEventStatus, formatDate } from "@/lib/eventUtils";
import StatusBadge from "@/components/events/StatusBadge";

export default function EventCarousel() {
  const navigate = useNavigate();
  const visibleEvents = config.events
    .filter((e) => {
      const status = getEventStatus(e as TournamentEvent);
      return status === "open" || status === "upcoming";
    })
    .sort((a, b) => {
      const sA = getEventStatus(a as TournamentEvent);
      const sB = getEventStatus(b as TournamentEvent);
      if (sA === "open" && sB !== "open") return -1;
      if (sA !== "open" && sB === "open") return 1;
      return new Date(a.eventStartDate).getTime() - new Date(b.eventStartDate).getTime();
    }) as TournamentEvent[];

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    slidesToScroll: 1,
  });

  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (visibleEvents.length === 0) return null;

  return (
    <section className="py-16 px-6" style={{ backgroundColor: "var(--color-page-bg)" }}>
      <div className="max-w-6xl mx-auto">
        <h2 className="font-heading font-bold text-2xl md:text-3xl mb-8">
          Upcoming Tournaments
        </h2>

        <div className="relative">
          {canPrev && (
            <button
              onClick={() => emblaApi?.scrollPrev()}
              className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
              style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {canNext && (
            <button
              onClick={() => emblaApi?.scrollNext()}
              className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
              style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-6">
              {visibleEvents.map((event, i) => {
                const status = getEventStatus(event);
                return (
                  <motion.div
                    key={event.id}
                    className="flex-none w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] cursor-pointer"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => navigate(`/event/${event.id}`)}
                  >
                    <div
                      className="card-lift rounded-xl overflow-hidden h-full"
                      style={{
                        backgroundColor: "var(--color-row-hover)",
                        border: "1px solid var(--color-table-border)",
                      }}
                    >
                      {/* Colored top bar */}
                      <div className="h-2" style={{ backgroundColor: "var(--color-primary)" }} />
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <h3
                            className="font-heading font-bold text-lg leading-tight line-clamp-2 flex-1 mr-2"
                          >
                            {event.name}
                          </h3>
                          <StatusBadge status={status} />
                        </div>
                        <p
                          className="text-sm mb-4 line-clamp-2 opacity-70"
                          style={{ color: "var(--color-body-text)" }}
                        >
                          {event.description}
                        </p>
                        <div className="space-y-1.5 text-sm" style={{ color: "var(--color-body-text)" }}>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 opacity-60" />
                            <span>
                              {formatDate(event.eventStartDate)} – {formatDate(event.eventEndDate)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 opacity-60" />
                            <span>{event.venue}</span>
                          </div>
                        </div>
                        <div className="mt-4 text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
                          {event.programs.length} program{event.programs.length !== 1 ? "s" : ""} available →
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
